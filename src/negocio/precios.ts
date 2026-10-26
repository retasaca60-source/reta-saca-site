// Cuánto cuesta una reserva (RESERVAS.md, secciones 3 y 4).
//
// El precio es POR MESA. En Cornhole depende de la modalidad: estándar (4
// personas) o para 2 personas, con su propia tabla. En Ping Pong se pueden
// sumar 2 palas extra. Desde el 21/10/2026 se paga siempre completo.

import type { ConfigDeporte, Configuracion, DeporteId, Duracion, Modalidad } from './configuracion'

/** La tabla de precios de esa modalidad. Si el deporte no la ofrece, la estándar. */
export function tablaDe(d: ConfigDeporte, modalidad: Modalidad = 'estandar'): Partial<Record<Duracion, number>> {
  return modalidad === 'pareja' && d.preciosPareja ? d.preciosPareja : d.precios
}

/** ¿Ese deporte ofrece esa modalidad? La estándar siempre. */
export const ofreceModalidad = (d: ConfigDeporte, modalidad: Modalidad) => modalidad === 'estandar' || d.preciosPareja !== null

/**
 * Promo: reservas estándar de la duración de la promo (60 min) que empiezan a
 * una de sus horas (5:00 PM), todos los días, si está activa y el deporte
 * tiene precio de promo. Se cobra entera a precio de promo, no se prorratea.
 * La modalidad para 2 personas no lleva promo: ya es más barata, y la promo de
 * Cornhole ($240) costaría más que la hora para 2 ($180).
 */
export function esPromo(config: Configuracion, deporte: DeporteId, inicio: number, duracion: number, modalidad: Modalidad = 'estandar'): boolean {
  const p = config.promo
  return modalidad === 'estandar' && p.activa && config.deportes[deporte].precioPromo !== null && duracion === p.duracion && p.inicios.includes(inicio)
}

export function precioDe(config: Configuracion, deporte: DeporteId, inicio: number, duracion: Duracion, modalidad: Modalidad = 'estandar') {
  const d = config.deportes[deporte]
  const conPromo = esPromo(config, deporte, inicio, duracion, modalidad)
  const precio = conPromo ? d.precioPromo! : tablaDe(d, modalidad)[duracion]
  if (precio === undefined) throw new Error(`${d.nombre} no tiene precio para ${duracion} min`)
  return { precio, conPromo }
}

/** Lo que se cobra por las palas extra: su precio si se pidieron y el juego las ofrece; si no, 0. */
export function precioDePalas(d: ConfigDeporte, palasExtra: boolean | undefined): number {
  return palasExtra && d.precioPalasExtra !== null ? d.precioPalasExtra : 0
}

/**
 * Precio para una duración cualquiera en minutos (una reserva extendida puede
 * durar 150). null si esa duración no está en la tabla del deporte.
 */
export function precioSiExiste(config: Configuracion, deporte: DeporteId, inicio: number, minutos: number, modalidad: Modalidad = 'estandar') {
  const d = config.deportes[deporte]
  const duracion = d.duraciones.find((x) => x === minutos)
  return duracion === undefined || tablaDe(d, modalidad)[duracion] === undefined ? null : precioDe(config, deporte, inicio, duracion, modalidad)
}

/**
 * Lo que se cobra al extender una reserva: la diferencia entre la duración
 * nueva y la anterior según la tabla de su modalidad (30 → 60 en Ping Pong =
 * $150 − $100 = $50; en Cornhole $280 − $160 = $120). Si la duración nueva no
 * está en la tabla (pasa de 1 h, lo máximo que se vende), se cobra lo que se
 * agrega por separado: el precio de ese tiempo si existe (+30 en Ping Pong =
 * $100, en Cornhole $160, para 2 personas $120) o, si no, la parte
 * proporcional de la hora.
 *
 * PENDIENTE DE CONFIRMAR CON HUGO: la regla de cobro de extensiones no se
 * decidió; esta es la propuesta (RESERVAS.md → Pendientes).
 */
export function precioDeExtension(config: Configuracion, deporte: DeporteId, duracionActual: number, extra: Duracion, modalidad: Modalidad = 'estandar'): number {
  const tabla = tablaDe(config.deportes[deporte], modalidad) as Record<number, number | undefined>
  const antes = tabla[duracionActual]
  const despues = tabla[duracionActual + extra]
  if (antes !== undefined && despues !== undefined) return despues - antes
  const suelto = tabla[extra] ?? Math.round(((tabla[60] ?? 0) * extra) / 60)
  return suelto
}
