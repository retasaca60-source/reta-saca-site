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

/**
 * ¿Se puede reservar esa hora? Tiene que terminar antes del cierre y quedar al
 * menos una mesa. Es la misma cuenta que pinta "Lleno" en pantalla: si las dos
 * se separan, vuelve a pasar que se reserva algo que la pantalla dice lleno.
 */
export function horaDisponible(deporte: DeporteId, dia: number, hora: number, duracion: Duracion): boolean {
  return horasQueCaben(duracion).includes(hora) && mesasOcupadas(deporte, dia, hora) < DEPORTES[deporte].mesas
}

/**
 * Una mesa LIBRE a esa hora, "CH 6". Antes se sorteaba entre todas y podía
 * tocar una de las ocupadas. Con la ocupación de ejemplo solo se sabe cuántas
 * hay ocupadas, no cuáles: se toman como ocupadas las primeras N. Cuando haya
 * base de datos, aquí se consultan las mesas reservadas de verdad.
 */
export function mesaLibre(deporte: DeporteId, dia: number, hora: number): string {
  const d = DEPORTES[deporte]
  const ocupadas = mesasOcupadas(deporte, dia, hora)
  const libres = d.mesas - ocupadas
  if (libres < 1) throw new Error(`Sin mesas libres de ${d.nombre} a las ${hora}:00`)
  return d.clave + ' ' + (ocupadas + 1 + Math.floor(Math.random() * libres))
}

// Sin 0/O ni 1/I/L: el folio se dicta por teléfono o se copia de un WhatsApp,
// y ahí esos se confunden.
const LETRAS_DE_FOLIO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/**
 * Folio de la reserva, "RS-4KD9Q". Siempre 5 caracteres: el anterior salía de
 * Math.random().toString(36) y a veces quedaba más corto. Que no se repita solo
 * se puede garantizar contra los folios guardados, cuando haya base de datos.
 */
export function folioDeReserva(): string {
  const azar = crypto.getRandomValues(new Uint8Array(5))
  return 'RS-' + Array.from(azar, (n) => LETRAS_DE_FOLIO[n % LETRAS_DE_FOLIO.length]).join('')
}
