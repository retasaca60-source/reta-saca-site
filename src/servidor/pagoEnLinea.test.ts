// El pago en línea con Clip, del lado del servidor: con un Clip de mentira
// que contesta lo que la prueba le diga. Lo que se prueba es lo que no
// se puede dejar al navegador: que solo un pago aprobado, en pesos y por el
// monto exacto confirme la mesa, que llegar dos veces no cobre dos veces, y
// que un pago que llega cuando ya no hay mesa quede por devolver.

import { beforeEach, describe, expect, it } from 'vitest'
import { USUARIOS_DEMO } from '../datos/ejemplos'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import type { Reserva } from '../negocio/reserva'
import { instante } from '../negocio/tiempo'

/** Los tableros de Cornhole: el juego de las pruebas de cupo. */
const LUGARES = CONFIGURACION_INICIAL.deportes.cornhole.mesas
import { atender, registrarPagoEnLinea, type CobroNuevo, type Entorno, type PagoEnLinea } from './api'
import { repositorioEnMemoria } from './repositorio'

const h = (x: number, m = 0) => x * 60 + m
const VIERNES = '2026-09-25'
let reloj = instante(VIERNES, h(15))
let e: Entorno
let cobros: CobroNuevo[]
let pagos: Map<string, PagoEnLinea>

/** El id que Clip le da al cobro de ese intento. */
const cobroDe = (c: CobroNuevo) => `clip-${c.intentoId}`

/** Quien paga en Clip: lo da por pagado (o lo que diga `cambios`) y devuelve el id del cobro. */
function pagarEnClip(cobro: CobroNuevo, cambios: Partial<PagoEnLinea> = {}): string {
  const id = cobroDe(cobro)
  pagos.set(id, { id, pagado: true, referencia: cobro.intentoId, monto: cobro.monto, moneda: 'MXN', ...cambios })
  return id
}

/** Paga en Clip y regresa al sitio, que manda el id del intento (?intento=…). */
async function volverDeClip(cobro: CobroNuevo, cambios: Partial<PagoEnLinea> = {}) {
  pagarEnClip(cobro, cambios)
  await llamar('verificarPagoEnLinea', { pagoId: cobro.intentoId })
}

async function llamar<T>(accion: string, datos: Record<string, unknown> = {}, cuentaId: string | null = null): Promise<T> {
  const r = await atender({ accion, datos }, { ...e, cuentaId })
  if ('error' in r) throw Object.assign(new Error(r.error.mensaje), { codigo: r.error.codigo })
  return r.resultado as T
}

const apartar = (whatsapp = '6621112233', nombre = 'Ana') =>
  llamar<Reserva>('apartar', {
    solicitud: { deporte: 'cornhole', fecha: VIERNES, inicio: h(19), duracion: 60, organizador: { nombre, whatsapp } },
  })

/** Aparta e inicia el pago: devuelve la reserva y el cobro que se le pidió a Clip. */
async function apartarYCobrar(whatsapp?: string, nombre?: string) {
  const r = await apartar(whatsapp, nombre)
  const { url } = await llamar<{ url: string }>('iniciarPago', { token: r.tokenPrivado, parteIds: [r.partes[0].id], nombre: '' })
  return { r, url, cobro: cobros[cobros.length - 1] }
}

/**
 * Una reserva dividida entre 2 como se hacían antes del 21/10/2026: ya no se
 * pueden crear, pero las que existen siguen con su link de cobro.
 */
async function dividirComoAntes(r: Reserva): Promise<Reserva> {
  const vieja: Reserva = {
    ...r,
    partesElegidas: 2,
    partes: [
      { ...r.partes[0], monto: r.precio / 2 },
      { id: 'parte-del-amigo', monto: r.precio / 2, delOrganizador: false, concepto: 'reserva', pago: null },
    ],
  }
  await e.repo.guardar(vieja)
  return vieja
}

const leer = (r: Reserva) => llamar<Reserva>('reservaPorTokenPrivado', { token: r.tokenPrivado })

beforeEach(async () => {
  reloj = instante(VIERNES, h(15))
  cobros = []
  pagos = new Map()
  const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
  for (const u of USUARIOS_DEMO) await repo.guardarPerfil(u)
  e = {
    repo,
    ahora: () => reloj,
    cuentaId: null,
    cuentas: { crear: async () => 'x', borrar: async () => {} },
    // Encendido a propósito: con Clip conectado no debe servir de nada.
    pagosSimulados: true,
    sitio: 'https://retasaca-hmo2.netlify.app',
    cliente: null,
    pasarela: {
      crearCobro: async (c) => {
        cobros.push(c)
        return { url: `https://clip.test/checkout/${c.intentoId}`, cobroId: cobroDe(c) }
      },
      consultarCobro: async (id) => pagos.get(id) ?? null,
    },
  }
})

describe('con Clip', () => {
  it('el cobro va por el monto de la parte, vence con el apartado y regresa a la reserva', async () => {
    const { r, url, cobro } = await apartarYCobrar()
    expect(url).toBe(`https://clip.test/checkout/${cobro.intentoId}`)
    expect(cobro.monto).toBe(r.partes[0].monto)
    expect(cobro.venceEn).toBe(r.apartadaHasta)
    expect(cobro.volverA).toBe(`https://retasaca-hmo2.netlify.app/r/${r.tokenPrivado}`)
    expect(cobro.titulo).toContain(r.folio)
  })

  it('la pantalla simulada ya no confirma nada', async () => {
    const { cobro } = await apartarYCobrar()
    await expect(llamar('pagoSimuladoConfirmar', { id: cobro.intentoId })).rejects.toMatchObject({ codigo: 'no_permitido' })
    expect(await llamar('pagoSimuladoObtener', { id: cobro.intentoId })).toBeNull()
  })

  it('un pago aprobado confirma la mesa una sola vez, llegue por el aviso o al volver', async () => {
    const { r, cobro } = await apartarYCobrar()
    const pagoId = pagarEnClip(cobro)

    await llamar('verificarPagoEnLinea', { pagoId: cobro.intentoId })
    const pagada = await leer(r)
    expect(pagada.estado).toBe('confirmada')
    expect(pagada.partes[0].pago).toMatchObject({ medio: 'en_linea', nombre: 'Ana' })

    // El aviso llega después, y luego otra vez: nada cambia.
    await registrarPagoEnLinea(pagoId, e)
    await registrarPagoEnLinea(pagoId, e)
    expect(await leer(r)).toEqual(pagada)
  })

  it('no confirma un pago rechazado, por otro monto, en otra moneda o que no es nuestro', async () => {
    const { r, cobro } = await apartarYCobrar()
    for (const cambios of [{ pagado: false }, { monto: cobro.monto - 1 }, { moneda: 'USD' }, { referencia: 'otro-intento' }]) {
      await volverDeClip(cobro, cambios)
    }
    await llamar('verificarPagoEnLinea', { pagoId: '999999' })
    await llamar('verificarPagoEnLinea', { pagoId: 'no-es-un-id' })
    expect((await leer(r)).estado).toBe('apartada')
  })

  it('si pagan cuando ya no hay mesa, el dinero queda por devolver y la mesa no se vende dos veces', async () => {
    const { r, cobro } = await apartarYCobrar()
    // Se le vence el apartado y otros grupos ocupan todos los tableros.
    reloj = instante(VIERNES, h(15, 11))
    for (let i = 0; i < LUGARES; i++) {
      const otro = await apartarYCobrar(`66200000${String(i).padStart(2, '0')}`, `Otro ${i}`)
      await volverDeClip(otro.cobro)
    }

    // Clip le cobró de todos modos.
    await volverDeClip(cobro)

    const despues = await leer(r)
    expect(despues.estado).toBe('cancelada')
    expect(despues.partes[0].pago).toBeNull()
    expect(despues.devolucion).toMatchObject({ estado: 'por_revisar', monto: cobro.monto, extra: cobro.monto })
    expect(despues.devolucion!.nota).toContain('el apartado ya se había vencido')

    const recepcion = USUARIOS_DEMO.find((u) => u.rol === 'recepcion')!.id
    const pendientes = await llamar<Reserva[]>('devolucionesPorRevisar', {}, recepcion)
    expect(pendientes.map((x) => x.folio)).toEqual([r.folio])
  })
})
it.each([false, true])(
  'un pago tardío revisa la fecha lejana de la reserva (lleno: %s)',
  async (lleno) => {
    const destino = '2026-12-02'
    const recepcion = USUARIOS_DEMO.find(
      (u) => u.rol === 'recepcion',
    )!.id

    const { r, cobro } = await apartarYCobrar()

    await llamar(
      'cambiarHorario',
      { reservaId: r.id, fecha: destino, inicio: h(19) },
      recepcion,
    )

    reloj = instante(VIERNES, h(15, 11))

    if (lleno) {
      // Todos los tableros se ocupan en el destino después de vencer el apartado.
      for (let i = 0; i < LUGARES; i++) {
        const otro = await apartarYCobrar(
          `66200000${String(i).padStart(2, '0')}`,
          `Otro ${i}`,
        )

        await registrarPagoEnLinea(
          pagarEnClip(otro.cobro),
          e,
        )

        await llamar(
          'cambiarHorario',
          { reservaId: otro.r.id, fecha: destino, inicio: h(19) },
          recepcion,
        )
      }
    }

    await registrarPagoEnLinea(pagarEnClip(cobro), e)

    const despues = await leer(r)
    expect(despues.fecha).toBe(destino)

    if (lleno) {
      expect(despues.estado).toBe('cancelada')
      expect(despues.partes[0].pago).toBeNull()
      expect(despues.devolucion).toMatchObject({
        estado: 'por_revisar',
        monto: cobro.monto,
        extra: cobro.monto,
      })
    } else {
      expect(despues.estado).toBe('confirmada')
      expect(despues.partes[0].pago).toMatchObject({
        medio: 'en_linea',
      })
      expect(despues.devolucion).toBeUndefined()
    }
  },
)
it('un pago tardío no recupera una mesa que ya fue asignada a otro grupo', async () => {
  const recepcion = USUARIOS_DEMO.find(
    (u) => u.rol === 'recepcion',
  )!.id

  const config = await e.repo.config()
  const mesa = `${config.deportes.cornhole.clave} 1`
  const { r, cobro } = await apartarYCobrar()

  await llamar(
    'asignarMesa',
    { reservaId: r.id, mesa },
    recepcion,
  )

  // Vence el primer apartado y otro grupo recibe esa mesa.
  reloj = instante(VIERNES, h(15, 11))

  const otro = await apartarYCobrar('6620000001', 'Otro grupo')

  await registrarPagoEnLinea(
    pagarEnClip(otro.cobro),
    e,
  )

  await llamar(
    'asignarMesa',
    { reservaId: otro.r.id, mesa },
    recepcion,
  )

  // Llega el pago del primer grupo: hay cupo, pero su mesa ya tiene dueño.
  await registrarPagoEnLinea(pagarEnClip(cobro), e)

  const recuperada = await leer(r)

  expect(recuperada.estado).toBe('confirmada')
  expect(recuperada.partes[0].pago).toMatchObject({
    medio: 'en_linea',
  })
  expect(recuperada.mesa).toBeNull()
  expect((await leer(otro.r)).mesa).toBe(mesa)

  // Recepción puede asignar otra mesa disponible.
  const otraMesa = `${config.deportes.cornhole.clave} 2`

  await llamar(
    'asignarMesa',
    { reservaId: r.id, mesa: otraMesa },
    recepcion,
  )

  expect((await leer(r)).mesa).toBe(otraMesa)
})
it.each(['inicio', 'terminada', 'dia_cerrado', 'bloque_reducido'])(
  'no recupera un apartado vencido con horario inválido: %s',
  async (caso) => {
    const { r, cobro } = await apartarYCobrar()
    reloj = instante(VIERNES, h(15, 11))

    const config = await e.repo.config()

    if (caso === 'inicio') {
      reloj = instante(VIERNES, h(19))
    }

    if (caso === 'terminada') {
      reloj = instante(VIERNES, h(20))
    }

    if (caso === 'dia_cerrado') {
      config.diasCerrados.push(VIERNES)
    }

    if (caso === 'bloque_reducido') {
      config.horario[5] = [
        { desde: h(17), hasta: h(19, 30) },
      ]
    }

    await e.repo.guardarConfig(config)

    await registrarPagoEnLinea(pagarEnClip(cobro), e)

    const despues = await leer(r)

    expect(despues.estado).toBe('cancelada')
    expect(despues.partes[0].pago).toBeNull()
    expect(despues.devolucion).toMatchObject({
      estado: 'por_revisar',
      monto: cobro.monto,
      extra: cobro.monto,
    })
    expect(despues.devolucion!.nota).toContain(
      'el horario de la reserva ya no estaba disponible',
    )
  },
)

it('recupera un apartado vencido antes del inicio aunque falten menos de 30 minutos', async () => {
  const { r, cobro } = await apartarYCobrar()
  reloj = instante(VIERNES, h(18, 50))

  await registrarPagoEnLinea(pagarEnClip(cobro), e)

  const despues = await leer(r)

  expect(despues.estado).toBe('confirmada')
  expect(despues.partes[0].pago).toMatchObject({
    medio: 'en_linea',
  })
  expect(despues.devolucion).toBeUndefined()
})
describe('link de cobro después del juego', () => {
  it('no deja pagar en línea una reserva que ya terminó', async () => {
    // Ping Pong de 7 a 8 PM entre 2, de antes del 21/10/2026: el organizador
    // pagó su parte en línea y el link de cobro de los amigos sigue vivo.
    const apartada = await llamar<Reserva>('apartar', {
      solicitud: { deporte: 'pingpong', fecha: VIERNES, inicio: h(19), duracion: 60, organizador: { nombre: 'Ana', whatsapp: '6621112233' } },
    })
    const r = await dividirComoAntes(apartada)
    await llamar('iniciarPago', { token: r.tokenPrivado, parteIds: [r.partes[0].id], nombre: '' })
    await registrarPagoEnLinea(pagarEnClip(cobros[0]), e)
    expect((await leer(r)).estado).toBe('confirmada')

    // A las 8 PM ya terminó: un amigo abre el link de cobro y ya no se le cobra.
    reloj = instante(VIERNES, h(20))
    await expect(
      llamar('iniciarPago', { token: r.tokenCobro, parteIds: [r.partes[1].id], nombre: 'Beto' }),
    ).rejects.toMatchObject({ codigo: 'no_permitido', message: expect.stringContaining('ya terminó') })
    expect(cobros).toHaveLength(1)
  })
})