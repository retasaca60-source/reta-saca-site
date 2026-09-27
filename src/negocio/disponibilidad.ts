// Cuántas mesas quedan libres (RESERVAS.md, sección 2 → Disponibilidad).
//
// Una reserva ocupa una mesa durante TODO su tiempo: una de 90 minutos a las
// 7:00 ocupa hasta las 8:30. Para saber si cabe una nueva se busca el momento
// de más ocupación dentro de su horario; ahí tiene que quedar al menos una.
// La versión anterior contaba cada hora por separado, y una reserva larga no
// le quitaba lugar a la hora siguiente.

import { mesasEnServicio, type Configuracion, type DeporteId } from './configuracion'
import { fin, ocupaMesa, type Reserva } from './reserva'

/** El máximo de mesas ocupadas a la vez dentro de [inicio, inicio+duración). */
export function ocupadasEn(
  reservas: readonly Reserva[],
  deporte: DeporteId,
  fecha: string,
  inicio: number,
  duracion: number,
  ahoraMs: number,
  ignorarId?: string,
): number {
  const final = inicio + duracion
  const cruzan = reservas.filter(
    (r) =>
      r.id !== ignorarId &&
      r.deporte === deporte &&
      r.fecha === fecha &&
      ocupaMesa(r, ahoraMs) &&
      r.inicio < final &&
      fin(r) > inicio,
  )
  // La ocupación solo sube cuando empieza una reserva: basta con contar en el
  // inicio pedido y en cada inicio que cae dentro del tramo.
  const puntos = [inicio, ...cruzan.map((r) => r.inicio).filter((t) => t > inicio && t < final)]
  return Math.max(0, ...puntos.map((t) => cruzan.filter((r) => r.inicio <= t && fin(r) > t).length))
}

export function mesasLibres(
  config: Configuracion,
  reservas: readonly Reserva[],
  deporte: DeporteId,
  fecha: string,
  inicio: number,
  duracion: number,
  ahoraMs: number,
  ignorarId?: string,
): number {
  return mesasEnServicio(config.deportes[deporte]) - ocupadasEn(reservas, deporte, fecha, inicio, duracion, ahoraMs, ignorarId)
}

/** "Quedan 3" cuando ya son pocas; null si no hace falta avisar. */
export function avisoPocosLugares(config: Configuracion, deporte: DeporteId, libres: number): string | null {
  if (libres < 1 || libres > config.deportes[deporte].avisarDesde) return null
  return libres === 1 ? 'Queda 1' : `Quedan ${libres}`
}

/** Números de mesa ocupados por reservas a las que recepción ya les asignó mesa y siguen en juego a esa hora. */
export function mesasAsignadasEn(reservas: readonly Reserva[], deporte: DeporteId, fecha: string, minuto: number, ahoraMs: number): string[] {
  return reservas
    .filter((r) => r.deporte === deporte && r.fecha === fecha && r.mesa && ocupaMesa(r, ahoraMs) && r.inicio <= minuto && fin(r) > minuto)
    .map((r) => r.mesa!)
}
