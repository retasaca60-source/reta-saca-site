import { describe, expect, it, vi } from 'vitest'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import type { Reserva } from '../negocio/reserva'
import { instante } from '../negocio/tiempo'
import { atender, registrarPagoEnLinea, type CobroNuevo, type Entorno, type PagoDeMercadoPago } from './api'
import { repositorioEnMemoria } from './repositorio'
import { mercadoPagoReal } from '../../supabase/fuentes/mercadopago'

async function preparar() {
  let ahora = instante('2026-10-19', 900)
  const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
  const cobros: CobroNuevo[] = []
  const pagos = new Map<string, PagoDeMercadoPago>()
  const crearCobro = vi.fn(async (c: CobroNuevo) => {
    cobros.push(c)
    return 'https://mercadopago.test/checkout'
  })
  const e: Entorno = {
    repo, ahora: () => ahora, cuentaId: null, cuentas: { crear: async () => '', borrar: async () => {} },
    pagosSimulados: false, sitio: 'https://example.test', cliente: null,
    mercadoPago: { crearCobro, consultarPago: async (id) => pagos.get(id) ?? null },
  }
  async function llamar<T>(accion: string, datos: Record<string, unknown>): Promise<T> {
    const respuesta = await atender({ accion, datos }, e)
    if ('error' in respuesta) throw Object.assign(new Error(respuesta.error.mensaje), { codigo: respuesta.error.codigo })
    return respuesta.resultado as T
  }
  const r = await llamar<Reserva>('apartar', { solicitud: {
    deporte: 'cornhole', fecha: '2026-10-19', inicio: 1140, duracion: 60, partes: 4,
    organizador: { nombre: 'Ana', whatsapp: '6621234567' },
  } })
  const iniciar = (ids: string[]) => llamar('iniciarPago', { token: r.tokenCobro, parteIds: ids, nombre: 'Amigo' })
  await iniciar([r.partes[0].id])
  const c = cobros[0]
  pagos.set('1', { id: '1', estado: 'approved', referencia: c.intentoId, monto: c.monto, moneda: 'MXN' })
  await registrarPagoEnLinea('1', e)
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

  it('envía el vencimiento efectivo a Mercado Pago también para un amigo', async () => {
    const venceEn = Date.now() + 600_000
    const pedir = vi.fn(async () => new Response(JSON.stringify({ init_point: 'https://mercadopago.test' }), { status: 200 }))
    vi.stubGlobal('fetch', pedir)
    try {
      await mercadoPagoReal('llave-de-prueba', { avisoA: 'https://example.test', usarSandbox: false }).crearCobro({
        intentoId: 'prueba', titulo: 'Reserva', monto: 75, volverA: 'https://example.test/c/token', venceEn,
      })
      const opciones = (pedir.mock.calls[0] as unknown as [string, RequestInit])[1]
      const cuerpo = JSON.parse(opciones.body as string)
      expect(cuerpo.expires).toBe(true)
      expect(Date.parse(cuerpo.expiration_date_to)).toBe(venceEn)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
