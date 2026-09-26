// Cuántas mesas quedan libres en un horario.
//
// HOY ES DE MENTIRA: no hay base de datos. La ocupación se inventa a partir
// del deporte, el día y la hora, siempre igual para la misma combinación, para
// que la demostración se vea creíble y no cambie al volver atrás. Cuando las
// reservas se guarden de verdad, `mesasOcupadas` es lo único que se reemplaza
// por una consulta; el resto de la aplicación no se entera.

import { CIERRE_EN_MINUTOS, DEPORTES, HORAS_DE_INICIO, type DeporteId, type Duracion } from './catalogo'

/**
 * Generador pseudoaleatorio con semilla, copiado tal cual del original.
 *
 * `h * 1103515245` rebasa la precisión exacta de los números de JavaScript y
 * el resultado depende de ese redondeo. No se "corrige" con Math.imul: daría
 * otra ocupación y la demostración dejaría de coincidir con la de antes.
 */
function azarConSemilla(texto: string): () => number {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1103515245 + 12345) >>> 0
    return (h % 1000) / 1000
  }
}

/** Mesas ocupadas (inventadas) para el deporte, el día (0 = hoy) y la hora de inicio. */
export function mesasOcupadas(deporte: DeporteId, dia: number, hora: number): number {
  const mesas = DEPORTES[deporte].mesas
  const v = azarConSemilla(deporte + '|' + dia + '|' + hora)()
  if (v < 0.12) return mesas
  if (v < 0.35) return Math.max(0, mesas - 1)
  if (v < 0.55) return Math.ceil(mesas / 2)
  return Math.floor(v * mesas * 0.4)
}

/** "Quedan 3 disponibles" cuando ya son pocas; null si no hace falta avisar. */
export function avisoPocosLugares(deporte: DeporteId, libres: number): string | null {
  if (libres < 1 || libres > DEPORTES[deporte].avisarDesde) return null
  return libres === 1 ? 'Queda 1 disponible' : 'Quedan ' + libres + ' disponibles'
}

/** Las horas de inicio con las que la reserva termina antes del cierre. */
export function horasQueCaben(duracion: Duracion): number[] {
  return HORAS_DE_INICIO.filter((h) => h * 60 + duracion <= CIERRE_EN_MINUTOS)
}

/** Una mesa al azar del deporte, "PP 4". Todavía no mira cuáles están libres. */
export function mesaAlAzar(deporte: DeporteId): string {
  const d = DEPORTES[deporte]
  return d.clave + ' ' + (1 + Math.floor(Math.random() * d.mesas))
}

/** Folio de la reserva, "RS-4KD9Q". Todavía no se revisa contra folios ya dados. */
export function folioDeReserva(): string {
  return 'RS-' + Math.random().toString(36).slice(2, 7).toUpperCase()
}
