// La hora del negocio: Sonora (America/Hermosillo), UTC−7 todo el año.
//
// Sonora no tiene horario de verano desde 1999, así que la cuenta es fija y no
// depende de la zona horaria de la computadora. Eso importa: una PC del equipo
// tenía la zona de Ciudad de México con la hora de Sonora puesta a mano, y todo
// lo que se calculaba "en hora local" salía una hora movido.
//
// Las fechas del negocio se manejan como texto "AAAA-MM-DD" y las horas como
// minutos desde medianoche (17:30 = 1050). Así nunca pasan por la zona horaria
// del aparato.
//
// OJO: `ahoraEnSonora()` usa el reloj del aparato. Mientras los datos sean
// simulados no hay otro; con la base de datos real, lo que decide si todavía se
// puede reservar lo calcula el servidor con SU reloj (ver CONTRATO-DE-DATOS.md).

const DESFASE_SONORA_MS = -7 * 60 * 60 * 1000

export interface Momento {
  /** "AAAA-MM-DD" en Sonora. */
  fecha: string
  /** Minutos desde medianoche en Sonora. */
  minutos: number
  /** Milisegundos desde 1970 (UTC), para comparar instantes. */
  ms: number
}

export function momentoDe(ms: number): Momento {
  const s = new Date(ms + DESFASE_SONORA_MS)
  return { fecha: s.toISOString().slice(0, 10), minutos: s.getUTCHours() * 60 + s.getUTCMinutes(), ms }
}

// De dónde sale "ahora". Normalmente, el reloj del aparato; la demostración lo
// cambia por su reloj de prueba (datos/index.ts). La versión real no lo toca:
// lo que importa ahí lo decide la hora del servidor.
let reloj: () => number = Date.now

export function usarReloj(f: () => number): void {
  reloj = f
}

export function ahoraEnSonora(): Momento {
  return momentoDe(reloj())
}

/** El instante (ms UTC) de una fecha y minuto de Sonora. */
export function instante(fecha: string, minutos: number): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return Date.UTC(a, m - 1, d, 0, minutos) - DESFASE_SONORA_MS
}

/** Suma días a una fecha "AAAA-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** 0 = domingo … 6 = sábado. */
export function diaDeLaSemana(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const
export const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

/** "Sáb 26/9" */
export function etiquetaFecha(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number)
  return DIAS_CORTOS[diaDeLaSemana(fecha)] + ' ' + d + '/' + m
}

/** "Hoy", "Mañana" o "Mié 30/9", contado desde hoy en Sonora. */
export function nombreDelDia(fecha: string): string {
  const hoy = ahoraEnSonora().fecha
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, 1)) return 'Mañana'
  return etiquetaFecha(fecha)
}

/** "sábado 26 de sep" */
export function fechaLarga(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number)
  return DIAS_LARGOS[diaDeLaSemana(fecha)] + ' ' + d + ' de ' + MESES[m - 1]
}

/** 1050 → "5:30 PM" */
export function formatoHora(minutos: number): string {
  const h24 = Math.floor(minutos / 60) % 24
  const mm = String(minutos % 60).padStart(2, '0')
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm} ${h24 >= 12 ? 'PM' : 'AM'}`
}

/** 1050 → "17:30" (para campos de hora del panel). */
export function horaDe24(minutos: number): string {
  return String(Math.floor(minutos / 60)).padStart(2, '0') + ':' + String(minutos % 60).padStart(2, '0')
}

/** "17:30" → 1050 */
export function minutosDe(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Mantiene la etiqueta de 90 min igual en horarios, pases y resúmenes. */
export function formatoDuracion(minutos: number): string {
  if (minutos === 90) return '90 min'

  const h = Math.floor(minutos / 60)
  const m = minutos % 60

  if (!h) return `${m} min`

  return m ? `${h} h ${m} min` : `${h} h`
}
