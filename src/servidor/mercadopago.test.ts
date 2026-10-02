// El pago con Mercado Pago, del lado del servidor: con un Mercado Pago de
// mentira que contesta lo que la prueba le diga. Lo que se prueba es lo que no
// se puede dejar al navegador: que solo un pago aprobado, en pesos y por el
// monto exacto confirme la mesa, que llegar dos veces no cobre dos veces, y
// que un pago que llega cuando ya no hay mesa quede por devolver.

import { beforeEach, describe, expect, it } from 'vitest'
import { USUARIOS_DEMO } from '../datos/ejemplos'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import type { Reserva } from '../negocio/reserva'
import { instante } from '../negocio/tiempo'
import { atender, registrarPagoEnLinea, type CobroNuevo, type Entorno, type PagoDeMercadoPago } from './api'
import { repositorioEnMemoria } from './repositorio'

const h = (x: number, m = 0) => x * 60 + m
const VIERNES = '2026-09-25'
let reloj = instante(VIERNES, h(15))
let e: Entorno
let cobros: CobroNuevo[]
let pagos: Map<string, PagoDeMercadoPago>
let siguientePago = 1000

/** Quien paga en Mercado Pago: aprueba (o lo que diga `cambios`) ese cobro y devuelve el id del pago. */
function pagarEnMercadoPago(cobro: CobroNuevo, cambios: Partial<PagoDeMercadoPago> = {}): string {
  const id = String(siguientePago++)
  pagos.set(id, { id, estado: 'approved', referencia: cobro.intentoId, monto: cobro.monto, moneda: 'MXN', ...cambios })
  return id
}

async function llamar<T>(accion: string, datos: Record<string, unknown> = {}, cuentaId: string | null = null): Promise<T> {
  const r = await atender({ accion, datos }, { ...e, cuentaId })
  if ('error' in r) throw Object.assign(new Error(r.error.mensaje), { codigo: r.error.codigo })
  return r.resultado as T
}

const apartar = (whatsapp = '6621112233', nombre = 'Ana') =>
  llamar<Reserva>('apartar', {
    solicitud: { deporte: 'popdarts', fecha: VIERNES, inicio: h(19), duracion: 60, partes: 1, organizador: { nombre, whatsapp } },
  })

/** Aparta e inicia el pago del organizador: devuelve la reserva y el cobro que se le pidió a Mercado Pago. */
async function apartarYCobrar(whatsapp?: string, nombre?: string) {
  const r = await apartar(whatsapp, nombre)
  const { url } = await llamar<{ url: string }>('iniciarPago', { token: r.tokenPrivado, parteIds: [r.partes[0].id], nombre: '' })
  return { r, url, cobro: cobros[cobros.length - 1] }
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
    // Encendido a propósito: con Mercado Pago conectado no debe servir de nada.
    pagosSimulados: true,
    sitio: 'https://retasaca-hmo2.netlify.app',
    cliente: null,
    mercadoPago: {
      crearCobro: async (c) => {
        cobros.push(c)
        return `https://mercadopago.test/checkout/${c.intentoId}`
      },
      consultarPago: async (id) => pagos.get(id) ?? null,
    },
  }
})

describe('con Mercado Pago', () => {
  it('el cobro va por el monto de la parte, vence con el apartado y regresa a la reserva', async () => {
    const { r, url, cobro } = await apartarYCobrar()
    expect(url).toBe(`https://mercadopago.test/checkout/${cobro.intentoId}`)
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
    const pagoId = pagarEnMercadoPago(cobro)

    await llamar('verificarPagoEnLinea', { pagoId })
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
    for (const cambios of [{ estado: 'rejected' }, { monto: cobro.monto - 1 }, { moneda: 'USD' }, { referencia: 'otro-intento' }]) {
      await llamar('verificarPagoEnLinea', { pagoId: pagarEnMercadoPago(cobro, cambios) })
    }
    await llamar('verificarPagoEnLinea', { pagoId: '999999' })
    await llamar('verificarPagoEnLinea', { pagoId: 'no-es-un-id' })
    expect((await leer(r)).estado).toBe('apartada')
  })

  it('si pagan cuando ya no hay mesa, el dinero queda por devolver y la mesa no se vende dos veces', async () => {
    const { r, cobro } = await apartarYCobrar()
    // Se le vence el apartado y otros tres ocupan las 3 mesas de Popdarts.
    reloj = instante(VIERNES, h(15, 11))
    for (let i = 0; i < 3; i++) {
      const otro = await apartarYCobrar(`662000000${i}`, `Otro ${i}`)
      await llamar('verificarPagoEnLinea', { pagoId: pagarEnMercadoPago(otro.cobro) })
    }

    // Mercado Pago le cobró de todos modos.
    await llamar('verificarPagoEnLinea', { pagoId: pagarEnMercadoPago(cobro) })

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
      // Las tres mesas se ocupan en el destino después de vencer el apartado.
      for (let i = 0; i < 3; i++) {
        const otro = await apartarYCobrar(
          `662000000${i}`,
          `Otro ${i}`,
        )

        await registrarPagoEnLinea(
          pagarEnMercadoPago(otro.cobro),
          e,
        )

        await llamar(
          'cambiarHorario',
          { reservaId: otro.r.id, fecha: destino, inicio: h(19) },
          recepcion,
        )
      }
    }

    await registrarPagoEnLinea(pagarEnMercadoPago(cobro), e)

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
