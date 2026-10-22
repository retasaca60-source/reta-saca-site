import { describe, expect, it, vi } from 'vitest'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import type { Reserva } from '../negocio/reserva'
import { instante } from '../negocio/tiempo'
import { atender, registrarPagoEnLinea, type CobroNuevo, type Entorno, type PagoEnLinea } from './api'
import { repositorioEnMemoria } from './repositorio'
import { clipReal } from '../../supabase/fuentes/clip'

/**
 * Los bloqueos protegen los links de cobro de las reservas que se dividieron
 * antes del 21/10/2026 (ya no se pueden crear, pero las que existen siguen
 * vivas): esto la reparte en 4 partes como se guardaban entonces.
 */
function dividirEnCuatro(r: Reserva): Reserva {
  const monto = r.precio / 4
  return {
    ...r,
    partesElegidas: 4,
    partes: [0, 1, 2, 3].map((i) => ({ id: i === 0 ? r.partes[0].id : `parte-${i}`, monto, delOrganizador: i === 0, concepto: 'reserva' as const, pago: null })),
  }
}

async function preparar() {
  let ahora = instante('2026-10-19', 900)
  const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
  const cobros: CobroNuevo[] = []
  const pagos = new Map<string, PagoEnLinea>()
  const crearCobro = vi.fn(async (c: CobroNuevo) => {
    cobros.push(c)
    return { url: 'https://clip.test/checkout', cobroId: `clip-${c.intentoId}` }
  })
  const e: Entorno = {
    repo, ahora: () => ahora, cuentaId: null, cuentas: { crear: async () => '', borrar: async () => {} },
    pagosSimulados: false, sitio: 'https://example.test', cliente: null,
    pasarela: { crearCobro, consultarCobro: async (id: string) => pagos.get(id) ?? null },
  }
  async function llamar<T>(accion: string, datos: Record<string, unknown>): Promise<T> {
    const respuesta = await atender({ accion, datos }, e)
    if ('error' in respuesta) throw Object.assign(new Error(respuesta.error.mensaje), { codigo: respuesta.error.codigo })
    return respuesta.resultado as T
  }
  const r = dividirEnCuatro(await llamar<Reserva>('apartar', { solicitud: {
    deporte: 'cornhole', fecha: '2026-10-19', inicio: 1140, duracion: 60,
    organizador: { nombre: 'Ana', whatsapp: '6621234567' },
  } }))
  await repo.guardar(r)
  const iniciar = (ids: string[]) => llamar('iniciarPago', { token: r.tokenCobro, parteIds: ids, nombre: 'Amigo' })
  await iniciar([r.partes[0].id])
  const c = cobros[0]
  pagos.set(`clip-${c.intentoId}`, { id: `clip-${c.intentoId}`, pagado: true, referencia: c.intentoId, monto: c.monto, moneda: 'MXN' })
  await registrarPagoEnLinea(`clip-${c.intentoId}`, e)
  return { r, repo, cobros, crearCobro, iniciar, avanzar: (ms: number) => { ahora += ms } }
}

describe('bloqueos con checkout externo', () => {
  it('dos solicitudes simultáneas de la misma parte solo crean una preferencia', async () => {
    const f = await preparar()
    const resultados = await Promise.allSettled([
      f.iniciar([f.r.partes[1].id]), f.iniciar([f.r.partes[1].id]),
    ])
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(f.crearCobro).toHaveBeenCalledTimes(2) // Organizador + un amigo.
  })

  it('tres amigos pueden abrir partes diferentes y cada checkout tiene el mismo vencimiento que su bloqueo', async () => {
    const f = await preparar()
    await Promise.all(f.r.partes.slice(1).map((p) => f.iniciar([p.id])))
    expect(f.cobros).toHaveLength(4)
    for (const c of f.cobros.slice(1)) {
      const intento = await f.repo.intento(c.intentoId)
      expect(c.venceEn).toBe(instante('2026-10-19', 910))
      expect(intento!.venceEn).toBe(c.venceEn)
    }
  })

  it('una respuesta perdida del proveedor no libera inmediatamente la parte y permite un segundo checkout', async () => {
    const f = await preparar()
    const registro = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      f.crearCobro.mockRejectedValueOnce(new Error('Respuesta perdida'))
      await expect(f.iniciar([f.r.partes[1].id])).rejects.toThrow()
      await expect(f.iniciar([f.r.partes[1].id])).rejects.toMatchObject({ codigo: 'no_permitido' })
      expect(f.crearCobro).toHaveBeenCalledTimes(2)
      f.avanzar(10 * 60_000)
      await expect(f.iniciar([f.r.partes[1].id])).resolves.toHaveProperty('url')
    } finally {
      registro.mockRestore()
    }
  })

  it('envía el vencimiento efectivo a Clip también para un amigo', async () => {
    // Al mediodía de Sonora, lejos de la medianoche de la Ciudad de México.
    const venceEn = instante('2026-10-19', 12 * 60 + 10)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(instante('2026-10-19', 12 * 60))
    const pedir = vi.fn(async () => new Response(JSON.stringify({ payment_request_id: 'abc', payment_request_url: 'https://clip.test' }), { status: 200 }))
    vi.stubGlobal('fetch', pedir)
    try {
      await clipReal('llave-de-prueba', { avisoA: 'https://example.test' }).crearCobro({
        intentoId: 'prueba', titulo: 'Reserva', monto: 75, volverA: 'https://example.test/c/token', venceEn,
      })
      const opciones = (pedir.mock.calls[0] as unknown as [string, RequestInit])[1]
      const cuerpo = JSON.parse(opciones.body as string)
      expect(Date.parse(cuerpo.expires_at)).toBe(venceEn)
    } finally {
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })
})

describe('reintento del organizador', () => {
  it('si sale de Clip sin pagar, puede volver a pagar mientras la mesa sigue apartada', async () => {
    let ahora = instante('2026-10-19', 900)
    const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
    const crearCobro = vi.fn(async (c: CobroNuevo) => ({ url: 'https://clip.test/checkout', cobroId: `clip-${c.intentoId}` }))
    const e: Entorno = {
      repo, ahora: () => ahora, cuentaId: null, cuentas: { crear: async () => '', borrar: async () => {} },
      pagosSimulados: false, sitio: 'https://example.test', cliente: null,
      pasarela: { crearCobro, consultarCobro: async () => null },
    }
    const apartado = await atender({ accion: 'apartar', datos: { solicitud: {
      deporte: 'pingpong', fecha: '2026-10-19', inicio: 1140, duracion: 60,
      organizador: { nombre: 'Ana', whatsapp: '6621234567' },
    } } }, e)
    const r = (apartado as { resultado: Reserva }).resultado
    const pagar = () => atender({ accion: 'iniciarPago', datos: { token: r.tokenPrivado, parteIds: [r.partes[0].id], nombre: 'Ana' } }, e)
    expect(await pagar()).toHaveProperty('resultado.url')
    ahora += 60_000
    expect(await pagar()).toHaveProperty('resultado.url')
    // El link de cobro sigue protegido: un amigo no abre otro checkout de esa parte.
    const amigo = await atender({ accion: 'iniciarPago', datos: { token: r.tokenCobro, parteIds: [r.partes[0].id], nombre: 'Beto' } }, e)
    expect(amigo).toMatchObject({ error: { codigo: 'no_permitido' } })
  })
})