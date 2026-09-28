// Cuánto cuesta una reserva (RESERVAS.md, secciones 3 y 4).
//
// El precio es POR MESA: no cambia por cuántos jueguen. Cuántos juegan solo
// decide en cuántas partes se divide el pago (reserva.ts → repartir).

import type { Configuracion, DeporteId, Duracion } from './configuracion'

/**
 * Promo: reservas de la duración de la promo (60 min) que empiezan a una de
 * sus horas (5:00 o 5:30 PM), todos los días, si está activa y el deporte tiene
 * precio de promo. Se cobra entera a precio de promo, no se prorratea.
 */
export function esPromo(config: Configuracion, deporte: DeporteId, inicio: number, duracion: number): boolean {
  const p = config.promo
  return p.activa && config.deportes[deporte].precioPromo !== null && duracion === p.duracion && p.inicios.includes(inicio)
}

export function precioDe(config: Configuracion, deporte: DeporteId, inicio: number, duracion: Duracion) {
  const d = config.deportes[deporte]
  const conPromo = esPromo(config, deporte, inicio, duracion)
  const precio = conPromo ? d.precioPromo! : d.precios[duracion]
  if (precio === undefined) throw new Error(`${d.nombre} no tiene precio para ${duracion} min`)
  return { precio, conPromo }
}

/**
 * Precio para una duración cualquiera en minutos (una reserva extendida puede
 * durar 150). null si esa duración no está en la tabla del deporte.
 */
export function precioSiExiste(config: Configuracion, deporte: DeporteId, inicio: number, minutos: number) {
  const d = config.deportes[deporte]
  const duracion = d.duraciones.find((x) => x === minutos)
  return duracion === undefined ? null : precioDe(config, deporte, inicio, duracion)
}

/**
 * Lo que se cobra al extender una reserva: la diferencia entre la duración
 * nueva y la anterior según la tabla (60 → 90 en Ping Pong = $220 − $150 =
 * $70). Si la duración nueva no está en la tabla (más de 2 horas), se cobra el
 * precio de lo que se agrega por separado.
 *
 * PENDIENTE DE CONFIRMAR CON HUGO: la regla de cobro de extensiones no se
 * decidió; esta es la propuesta (RESERVAS.md → Pendientes).
 */
export function precioDeExtension(config: Configuracion, deporte: DeporteId, duracionActual: number, extra: Duracion): number {
  const tabla = config.deportes[deporte].precios as Record<number, number | undefined>
  const antes = tabla[duracionActual]
  const despues = tabla[duracionActual + extra]
  if (antes !== undefined && despues !== undefined) return despues - antes
  const suelto = tabla[extra] ?? Math.round(((tabla[60] ?? 0) * extra) / 60)
  return suelto
}
