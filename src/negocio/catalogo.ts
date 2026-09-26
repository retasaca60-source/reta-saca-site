// Qué se renta, cuántas mesas hay y cuánto cuesta.
//
// Si cambia un precio, un horario o llega una mesa nueva, se toca AQUÍ y en
// ningún otro archivo. Las pantallas y las reglas de precios.ts leen de esta
// tabla; no traen números propios.

export type DeporteId = 'pingpong' | 'cornhole' | 'popdarts'
export type Duracion = 30 | 60 | 90 | 120
export type Personas = 2 | 4
export type TablaPrecios = Record<Duracion, number>

export interface Deporte {
  nombre: string
  /** Prefijo de la mesa: "PP 3", "CH 5". */
  clave: string
  mesas: number
  icono: 'paleta' | 'costal' | 'diana'
  /** Opciones que se ofrecen y la que va marcada como "Recomendado". */
  personas: readonly Personas[]
  recomendado: Personas
  /**
   * Si el número de jugadores no cambia el precio, se deja marcado de entrada
   * para no obligar a un toque que no decide nada. Se puede cambiar igual.
   */
  personasPorOmision?: Personas
  /** Lo que se le dice al cliente debajo de "¿Cuántos jugadores?". */
  pistaPersonas: string
  duraciones: readonly Duracion[]
  precios: Record<Personas, TablaPrecios>
  /** Sin tabla de promo, el deporte nunca entra en promoción. */
  promo?: Record<Personas, TablaPrecios>
  /**
   * Hasta cuántos minutos se cobra TODO al reservar. Por encima, solo el
   * anticipo de ANTICIPOS y el resto en el lugar. 0 = siempre anticipo.
   */
  pagoCompletoHasta: number
  /** Con cuántos lugares libres o menos se avisa "Quedan N disponibles". */
  avisarDesde: number
}

export const DEPORTES: Record<DeporteId, Deporte> = {
  pingpong: {
    nombre: 'Ping Pong',
    clave: 'PP',
    mesas: 6,
    icono: 'paleta',
    personas: [2, 4],
    recomendado: 2,
    pistaPersonas: '$50 pesos más si son 4 personas.',
    duraciones: [30, 60, 90, 120],
    precios: {
      2: { 30: 100, 60: 150, 90: 220, 120: 280 },
      4: { 30: 150, 60: 200, 90: 270, 120: 330 },
    },
    promo: {
      2: { 30: 80, 60: 120, 90: 175, 120: 225 },
      4: { 30: 130, 60: 170, 90: 225, 120: 275 },
    },
    pagoCompletoHasta: 60,
    avisarDesde: 3,
  },
  cornhole: {
    nombre: 'Cornhole',
    clave: 'CH',
    mesas: 8,
    icono: 'costal',
    personas: [2, 4],
    recomendado: 4,
    pistaPersonas: 'El estándar y los torneos serán de 4 personas.',
    duraciones: [60, 90, 120],
    precios: {
      2: { 30: 100, 60: 150, 90: 220, 120: 280 },
      4: { 30: 200, 60: 300, 90: 440, 120: 560 },
    },
    promo: {
      2: { 30: 80, 60: 120, 90: 175, 120: 225 },
      4: { 30: 160, 60: 240, 90: 350, 120: 450 },
    },
    pagoCompletoHasta: 0,
    avisarDesde: 3,
  },
  popdarts: {
    nombre: 'Popdarts',
    clave: 'PD',
    mesas: 3,
    icono: 'diana',
    // 2 o 4 cuestan lo mismo, pero se guarda cuántos vienen de verdad: el
    // cliente lo ve en su resumen y recepción sabe para cuántos preparar.
    personas: [2, 4],
    recomendado: 2,
    personasPorOmision: 2,
    pistaPersonas: 'La cantidad de jugadores no afecta el precio.',
    duraciones: [60, 90, 120],
    precios: {
      2: { 30: 60, 60: 120, 90: 175, 120: 230 },
      4: { 30: 60, 60: 120, 90: 175, 120: 230 },
    },
    pagoCompletoHasta: 120,
    avisarDesde: 1,
  },
}

/** El orden en que aparecen en pantalla. */
export const ORDEN_DEPORTES: readonly DeporteId[] = ['pingpong', 'cornhole', 'popdarts']

/** Anticipo cuando no se cobra todo al reservar. */
export const ANTICIPOS: Record<Duracion, number> = { 30: 50, 60: 75, 90: 110, 120: 140 }

/** Horas de inicio que se ofrecen (formato 24 h). */
export const HORAS_DE_INICIO: readonly number[] = [17, 18, 19, 20, 21, 22]

/** El lugar cierra a las 23:00: ninguna reserva puede terminar después. */
export const CIERRE_EN_MINUTOS = 23 * 60

/** La promo solo aplica a reservas de esta duración. */
export const DURACION_CON_PROMO: Duracion = 60

/** Sin ser domingo, la promo es solo a esta hora de inicio. */
export const HORA_CON_PROMO = 17

/** Cuántos días hacia adelante se pueden elegir, empezando hoy. */
export const DIAS_VISIBLES = 10
