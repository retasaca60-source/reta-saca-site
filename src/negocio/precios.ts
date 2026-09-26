// Cuánto se cobra, cuándo hay promo y cuánto se paga al reservar.
//
// Son funciones puras: mismos datos, mismo resultado. Por eso tienen pruebas
// (precios.test.ts) y por eso no leen la fecha de hoy: reciben si es domingo.

import {
  ANTICIPOS,
  DEPORTES,
  DURACION_CON_PROMO,
  HORA_CON_PROMO,
  type DeporteId,
  type Duracion,
  type Personas,
} from './catalogo'

/** ¿El deporte admite promo para esa duración? Decide si se muestra la franja de promo. */
export function hayPromoParaDuracion(deporte: DeporteId, duracion: Duracion): boolean {
  return Boolean(DEPORTES[deporte].promo) && duracion === DURACION_CON_PROMO
}

/** Domingo, todo el día; entre semana, solo la primera hora. */
export function esHorarioPromo(deporte: DeporteId, esDomingo: boolean, hora: number, duracion: Duracion): boolean {
  if (!hayPromoParaDuracion(deporte, duracion)) return false
  return esDomingo || hora === HORA_CON_PROMO
}

export function precioPara(deporte: DeporteId, personas: Personas, duracion: Duracion, conPromo: boolean): number {
  const d = DEPORTES[deporte]
  const tabla = conPromo && d.promo ? d.promo : d.precios
  return tabla[personas][duracion]
}

/** El precio por hora que se anuncia en la tarjeta del deporte: sin promo, con las personas recomendadas. */
export function precioDeLista(deporte: DeporteId): number {
  const d = DEPORTES[deporte]
  return d.precios[d.recomendado][60]
}

/** ¿Se cobra todo al reservar, o solo un anticipo? */
export function sePagaTodoAlReservar(deporte: DeporteId, duracion: Duracion): boolean {
  return duracion <= DEPORTES[deporte].pagoCompletoHasta
}

/** Lo que se paga al reservar. El resto (total − esto) se paga en el lugar. */
export function anticipoPara(deporte: DeporteId, duracion: Duracion, total: number): number {
  return sePagaTodoAlReservar(deporte, duracion) ? total : ANTICIPOS[duracion]
}
