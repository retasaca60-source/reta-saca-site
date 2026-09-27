// Las reglas de RESERVAS.md escritas como pruebas. Si alguien cambia una regla
// sin querer, `npm test` lo dice. Si el cambio SÍ es a propósito, se cambia
// primero RESERVAS.md y después esta prueba.

import { describe, expect, it } from 'vitest'
import { CONFIGURACION_INICIAL as C, type Configuracion } from './configuracion'
import { ocupadasEn } from './disponibilidad'
import { diasReservables, iniciosPosibles } from './horario'
import { esPromo, precioDe } from './precios'
import { puedeCancelarConDevolucion, puedeLiberarPorRetraso, repartir, type Reserva } from './reserva'
import { diaDeLaSemana, formatoHora, instante, momentoDe } from './tiempo'

const h = (x: number, m = 0) => x * 60 + m
// Viernes 25/09/2026, 3:00 PM en Sonora.
const VIERNES = '2026-09-25'
const ahora = momentoDe(instante(VIERNES, h(15)))

describe('tiempo de Sonora', () => {
  it('el instante y la fecha van y vuelven sin moverse, sin importar la zona de la computadora', () => {
    const m = momentoDe(instante('2026-09-25', h(21, 30)))
    expect(m).toMatchObject({ fecha: '2026-09-25', minutos: h(21, 30) })
    // 11:30 PM en Sonora ya es el día siguiente en UTC; la fecha de Sonora no cambia.
    expect(momentoDe(instante('2026-09-25', h(23, 30))).fecha).toBe('2026-09-25')
  })
  it('25/09/2026 es viernes y se escribe bien la hora', () => {
    expect(diaDeLaSemana(VIERNES)).toBe(5)
    expect(formatoHora(h(17, 30))).toBe('5:30 PM')
    expect(formatoHora(h(9))).toBe('9:00 AM')
  })
})

describe('horario (RESERVAS.md §2)', () => {
  it('entre semana: de 5 a 10 PM, cada 30 min, terminando antes del cierre', () => {
    expect(iniciosPosibles(C, '2026-09-28', 60, ahora)).toEqual([h(17), h(17, 30), h(18), h(18, 30), h(19), h(19, 30), h(20), h(20, 30), h(21)])
    expect(iniciosPosibles(C, '2026-09-28', 120, ahora).at(-1)).toBe(h(20))
    expect(iniciosPosibles(C, '2026-09-28', 30, ahora).at(-1)).toBe(h(21, 30))
  })
  it('sábado y domingo: también de 9 AM a 12 PM, sin cruzar de un bloque al otro', () => {
    const sabado = iniciosPosibles(C, '2026-09-26', 60, ahora)
    expect(sabado.slice(0, 5)).toEqual([h(9), h(9, 30), h(10), h(10, 30), h(11)])
    expect(sabado).not.toContain(h(11, 30))
    expect(sabado).toContain(h(17))
  })
  it('para hoy, solo hasta 30 min antes', () => {
    const tarde = momentoDe(instante(VIERNES, h(18, 40)))
    const hoy = iniciosPosibles(C, VIERNES, 60, tarde)
    expect(hoy).not.toContain(h(19))
    expect(hoy[0]).toBe(h(19, 30))
  })
  it('ventana de 7 días móvil: viernes → hasta el viernes siguiente', () => {
    const dias = diasReservables(C, ahora)
    expect(dias.map((d) => d.fecha)).toEqual([VIERNES, '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(iniciosPosibles(C, '2026-10-03', 60, ahora)).toEqual([])
  })
  it('un día cerrado no ofrece horas', () => {
    const cerrado: Configuracion = { ...C, diasCerrados: ['2026-09-28'] }
    expect(iniciosPosibles(cerrado, '2026-09-28', 60, ahora)).toEqual([])
  })
})

describe('precios (RESERVAS.md §3 y §4)', () => {
  it('precio por mesa', () => {
    expect(precioDe(C, 'pingpong', h(19), 90).precio).toBe(220)
    expect(precioDe(C, 'cornhole', h(19), 120).precio).toBe(560)
    expect(precioDe(C, 'popdarts', h(19), 90).precio).toBe(180)
    expect(precioDe(C, 'popdarts', h(19), 120).precio).toBe(240)
  })
  it('promo: 60 min que empiezan 5:00 o 5:30, cualquier día', () => {
    expect(precioDe(C, 'pingpong', h(17), 60)).toEqual({ precio: 120, conPromo: true })
    expect(precioDe(C, 'cornhole', h(17, 30), 60)).toEqual({ precio: 240, conPromo: true })
    expect(esPromo(C, 'pingpong', h(18), 60)).toBe(false)
    expect(esPromo(C, 'pingpong', h(17), 90)).toBe(false)
    expect(esPromo(C, 'popdarts', h(17), 60)).toBe(false)
  })
  it('la promo se puede apagar', () => {
    expect(esPromo({ ...C, promo: { ...C.promo, activa: false } }, 'pingpong', h(17), 60)).toBe(false)
  })
  it('partes en pesos cerrados; el organizador absorbe la diferencia', () => {
    expect(repartir(150, 4)).toEqual([39, 37, 37, 37])
    expect(repartir(300, 4)).toEqual([75, 75, 75, 75])
    expect(repartir(220, 2)).toEqual([110, 110])
    expect(repartir(120, 1)).toEqual([120])
  })
})

const reserva = (extra: Partial<Reserva>): Reserva => ({
  id: 'x', folio: 'RS-X', tokenPrivado: 'p', tokenCobro: 'c', deporte: 'pingpong', fecha: VIERNES, inicio: h(19), duracion: 60,
  precio: 150, conPromo: false, partesElegidas: 1, partes: [], organizador: { nombre: 'A', whatsapp: '6620000000' }, origen: 'sitio',
  estado: 'confirmada', apartadaHasta: null, mesa: null, llegaronEn: null, cancelacion: null, creadaEn: '', ...extra,
})

describe('disponibilidad (RESERVAS.md §2)', () => {
  it('una reserva de 90 min a las 7 ocupa también la media hora de las 8', () => {
    const r = [reserva({ id: 'a', inicio: h(19), duracion: 90 })]
    expect(ocupadasEn(r, 'pingpong', VIERNES, h(20), 60, ahora.ms)).toBe(1)
    expect(ocupadasEn(r, 'pingpong', VIERNES, h(20, 30), 60, ahora.ms)).toBe(0)
  })
  it('cuenta el momento de más ocupación dentro del tramo, no solo el inicio', () => {
    const r = [reserva({ id: 'a', inicio: h(19), duracion: 60 }), reserva({ id: 'b', inicio: h(19, 30), duracion: 60 })]
    expect(ocupadasEn(r, 'pingpong', VIERNES, h(19), 120, ahora.ms)).toBe(2)
  })
  it('un apartado vencido ya no ocupa; uno vigente sí', () => {
    const vencido = reserva({ estado: 'apartada', apartadaHasta: ahora.ms - 1 })
    const vigente = reserva({ estado: 'apartada', apartadaHasta: ahora.ms + 60_000 })
    expect(ocupadasEn([vencido], 'pingpong', VIERNES, h(19), 60, ahora.ms)).toBe(0)
    expect(ocupadasEn([vigente], 'pingpong', VIERNES, h(19), 60, ahora.ms)).toBe(1)
  })
})

describe('cancelación y tolerancia (RESERVAS.md §7)', () => {
  const r = reserva({ inicio: h(19) })
  it('con devolución hasta 2 horas antes', () => {
    expect(puedeCancelarConDevolucion(r, C, instante(VIERNES, h(17)))).toBe(true)
    expect(puedeCancelarConDevolucion(r, C, instante(VIERNES, h(17, 1)))).toBe(false)
  })
  it('se puede liberar la mesa a los 20 minutos si no llegaron', () => {
    expect(puedeLiberarPorRetraso(r, C, instante(VIERNES, h(19, 19)))).toBe(false)
    expect(puedeLiberarPorRetraso(r, C, instante(VIERNES, h(19, 20)))).toBe(true)
    expect(puedeLiberarPorRetraso({ ...r, llegaronEn: 'ya' }, C, instante(VIERNES, h(19, 30)))).toBe(false)
  })
})
