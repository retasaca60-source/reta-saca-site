// Levantar la mesa (desde el 23/11/2026), en las dos versiones del contrato:
// la simulada y la real (el servidor con la base en memoria). El grupo deja
// de jugar: si es antes de su hora, la reserva se corta ahí y el resto queda
// libre; no se devuelve nada. En el primer juego de un combo, se libera
// también el segundo.

import { beforeEach, describe, expect, it } from 'vitest'
import { instante } from '../negocio/tiempo'
import { total, type Reserva } from '../negocio/reserva'
import { conexionEnMemoria } from '../servidor/conexionEnMemoria'
import { ErrorDeDatos, type PagoSimulado, type ServicioDeDatos } from './contrato'
import { crearServicioReal } from './real'
import { almacenEnMemoria, crearServicioSimulado } from './simulado'

const h = (x: number, m = 0) => x * 60 + m
const VIERNES = '2026-09-25'
let reloj = instante(VIERNES, h(19))
let s: ServicioDeDatos & { pagoSimulado: PagoSimulado }

const codigoDe = async (p: Promise<unknown>) => {
  try {
    await p
    return 'sin error'
  } catch (e) {
    return e instanceof ErrorDeDatos ? e.codigo : String(e)
  }
}

const delDia = async () => s.reservasEntre(VIERNES, VIERNES)
const porId = async (id: string) => (await delDia()).find((r) => r.id === id) as Reserva

describe.each(['simulado', 'real'] as const)('levantar mesa · versión %s', (version) => {
  beforeEach(async () => {
    reloj = instante(VIERNES, h(19))
    s =
      version === 'simulado'
        ? crearServicioSimulado({ almacen: almacenEnMemoria(), reloj: () => reloj, conEjemplos: false })
        : crearServicioReal(conexionEnMemoria(() => reloj).conexion)
    await s.iniciarSesion('recepcion', '')
  })

  it('antes de su hora: la reserva se corta ahí, la mesa queda libre y lo pagado no cambia', async () => {
    const r = await s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Ana', medio: 'efectivo', mesa: 'PP 1' })
    reloj = instante(VIERNES, h(19, 35))
    const levantada = await s.levantarMesa(r.id)
    expect(levantada.duracion).toBe(35)
    expect(levantada.levantada).toMatchObject({ por: 'Recepción', duracionAntes: 60 })
    expect(total(levantada)).toBe(150)
    expect(levantada.devolucion ?? null).toBeNull()
    // La misma mesa se puede dar a otro grupo desde ya.
    const otro = await s.anotarSinReserva({ deporte: 'pingpong', duracion: 30, nombre: 'Beto', medio: 'tarjeta', mesa: 'PP 1' })
    expect(otro.mesa).toBe('PP 1')
  })

  it('ya levantada no se extiende, no se mueve, no se cancela ni se levanta otra vez; antes de empezar no se levanta', async () => {
    const r = await s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Ana', medio: 'efectivo', mesa: 'PP 1' })
    reloj = instante(VIERNES, h(19, 20))
    await s.levantarMesa(r.id)
    expect(await codigoDe(s.levantarMesa(r.id))).toBe('no_permitido')
    expect(await codigoDe(s.extender(r.id, 30))).toBe('no_permitido')
    expect(await codigoDe(s.cambiarHorario(r.id, VIERNES, h(21)))).toBe('no_permitido')
    expect(await codigoDe(s.cancelarComoNegocio(r.id))).toBe('no_permitido')

    const futura = await s.apartar({ deporte: 'cornhole', fecha: VIERNES, inicio: h(21), duracion: 60, organizador: { nombre: 'Caro', whatsapp: '6621112233' } })
    const { url } = await s.iniciarPago(futura.tokenPrivado, [futura.partes[0].id], '')
    await s.pagoSimulado.confirmar(url.split('/').pop()!)
    expect(await codigoDe(s.levantarMesa(futura.id))).toBe('no_permitido')
  })

  it('con el tiempo ya cumplido solo queda anotado: no cambia su hora', async () => {
    const r = await s.anotarSinReserva({ deporte: 'cornhole', duracion: 30, nombre: 'Ana', medio: 'efectivo', mesa: 'CH 1' })
    reloj = instante(VIERNES, h(19, 45))
    const levantada = await s.levantarMesa(r.id)
    expect(levantada.duracion).toBe(30)
    expect(levantada.levantada?.duracionAntes).toBe(30)
  })

  it('en el primer juego de un combo, antes de su hora, se libera también el segundo', async () => {
    const t1 = await s.anotarComboSinReserva({ primero: 'cornhole', modalidad: 'estandar', nombre: 'Combo', medio: 'efectivo', mesa: 'CH 1' })
    reloj = instante(VIERNES, h(19, 10))
    await s.levantarMesa(t1.id)
    const [a, b] = (await delDia()).filter((r) => r.combo)
    expect([a.duracion, b.duracion]).toEqual([10, 0])
    expect(b.levantada?.duracionAntes).toBe(30)
    expect(total(await porId(t1.id))).toBe(280)
  })

  it('en el primer juego de un combo con su media hora cumplida, el segundo se queda: pasan a jugarlo', async () => {
    const t1 = await s.anotarComboSinReserva({ primero: 'cornhole', modalidad: 'pareja', nombre: 'Combo', medio: 'efectivo', mesa: 'CH 1' })
    reloj = instante(VIERNES, h(19, 32))
    await s.levantarMesa(t1.id)
    const [, b] = (await delDia()).filter((r) => r.combo)
    expect(b.duracion).toBe(30)
    expect(b.levantada).toBeUndefined()
  })
})
