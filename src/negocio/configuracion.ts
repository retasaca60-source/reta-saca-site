// Todo lo del negocio que Hugo puede cambiar desde el panel: mesas, precios,
// promo, horario y días cerrados, más las reglas de reserva (RESERVAS.md).
//
// CONFIGURACION_INICIAL es con lo que arranca el sitio. Desde que hay panel, la
// configuración vigente vive en los datos (hoy el navegador, después Supabase)
// y ESTE archivo solo se usa la primera vez. Si cambias un precio aquí y no se
// ve, es porque ya hay una configuración guardada: se cambia desde el panel.

// Popdarts salió del negocio el 21/10/2026. Las reservas viejas de Popdarts
// que haya en los datos se ignoran al leerlas (ver esDeporteVigente).
export type DeporteId = 'pingpong' | 'cornhole'
export type Duracion = 30 | 60 | 90 | 120

/**
 * En cuántas partes se dividía el pago. Desde el 21/10/2026 siempre se paga
 * completo (1); el tipo se queda porque las reservas viejas lo guardan.
 */
export type Partes = 1 | 2 | 4

/**
 * Cornhole se juega 2 vs 2 (estándar, 4 personas) o 1 vs 1 (2 personas), con
 * precio distinto. Ping Pong solo tiene la estándar.
 */
export type Modalidad = 'estandar' | 'pareja'

export interface ConfigDeporte {
  nombre: string
  /** Prefijo de la mesa en el panel: "PP 3", "CH 5". */
  clave: string
  icono: 'paleta' | 'costal'
  /** Cuántas mesas hay en el local. */
  mesas: number
  /** Números de las mesas fuera de servicio (1 = la primera). No se venden. */
  fueraDeServicio: number[]
  /** Las que se pueden cobrar en el local. En línea, solo las de `reglas.duracionesEnLinea`. */
  duraciones: Duracion[]
  /** Precio por mesa en la modalidad estándar. */
  precios: Partial<Record<Duracion, number>>
  /** Precio para 2 personas (Cornhole). null = no se ofrece esa modalidad. */
  preciosPareja: Partial<Record<Duracion, number>> | null
  /** Precio con promo (solo modalidad estándar y la duración de la promo). Sin él, no hay promo. */
  precioPromo: number | null
  /**
   * Ping Pong trae 2 palas; esto es lo que cuestan 2 palas más (para jugar
   * dobles). null = no se ofrece.
   */
  precioPalasExtra: number | null
  /** Con cuántas mesas libres o menos se avisa "Quedan N". */
  avisarDesde: number
}

/** Un tramo abierto del día, en minutos desde medianoche: 17:00 = 1020. */
export interface Bloque {
  desde: number
  hasta: number
}

export interface Configuracion {
  deportes: Record<DeporteId, ConfigDeporte>
  /** Bloques abiertos por día de la semana: 0 = domingo … 6 = sábado. */
  horario: Record<number, Bloque[]>
  /** Días que no abre, "AAAA-MM-DD". */
  diasCerrados: string[]
  promo: {
    activa: boolean
    /** Horas de inicio con promo, en minutos. */
    inicios: number[]
    duracion: Duracion
  }
  reglas: {
    /** Cuántos días hacia adelante se puede reservar (ventana móvil). */
    diasDeAnticipacion: number
    /** Para hoy: hasta cuántos minutos antes del inicio. */
    minutosDeCorte: number
    /** Cada cuántos minutos se puede empezar en línea: 30 = a la hora y a la media (5:00, 5:30…). */
    pasoDeInicio: number
    /** Cuánto se aparta la mesa mientras se paga. */
    minutosDeApartado: number
    /** Después de cuántos minutos sin llegar se puede liberar la mesa. */
    minutosDeTolerancia: number
    /** Duraciones que se pueden reservar en línea. En el local se cobran todas las del deporte. */
    duracionesEnLinea: Duracion[]
  }
  /** WhatsApp del negocio, 10 dígitos. Vacío = todavía no lo da Hugo. */
  whatsappNegocio: string
}

export const ORDEN_DEPORTES: readonly DeporteId[] = ['pingpong', 'cornhole']

export const esDeporteVigente = (x: unknown): x is DeporteId => ORDEN_DEPORTES.includes(x as DeporteId)

const h = (horas: number, minutos = 0) => horas * 60 + minutos
const MANANA: Bloque = { desde: h(9), hasta: h(12) }
const TARDE: Bloque = { desde: h(17), hasta: h(22) }
/** Viernes y sábado se cierra a las 11 PM. */
const TARDE_LARGA: Bloque = { desde: h(17), hasta: h(23) }

export const CONFIGURACION_INICIAL: Configuracion = {
  deportes: {
    pingpong: {
      nombre: 'Ping Pong',
      clave: 'PP',
      icono: 'paleta',
      mesas: 6,
      fueraDeServicio: [],
      duraciones: [30, 60, 90, 120],
      precios: { 30: 100, 60: 150, 90: 220, 120: 280 },
      preciosPareja: null,
      precioPromo: 120,
      precioPalasExtra: 50,
      avisarDesde: 3,
    },
    cornhole: {
      nombre: 'Cornhole',
      clave: 'CH',
      icono: 'costal',
      // Hugo dijo "6 a 8": se arranca con 6 porque vender de más deja a alguien
      // que ya pagó sin tablero. Él lo sube desde el panel.
      mesas: 6,
      fueraDeServicio: [],
      duraciones: [60, 90, 120],
      precios: { 60: 280, 90: 410, 120: 540 },
      preciosPareja: { 60: 200, 90: 290, 120: 380 },
      precioPromo: 240,
      precioPalasExtra: null,
      avisarDesde: 3,
    },
  },
  horario: {
    0: [MANANA, TARDE],
    1: [TARDE],
    2: [TARDE],
    3: [TARDE],
    4: [TARDE],
    5: [TARDE_LARGA],
    6: [MANANA, TARDE_LARGA],
  },
  diasCerrados: [],
  // La promo es solo la hora de las 5:00. La de las 5:30 se quitó el 21/10 y no
  // regresó cuando volvieron los inicios cada media hora.
  promo: { activa: true, inicios: [h(17)], duracion: 60 },
  reglas: {
    diasDeAnticipacion: 7,
    minutosDeCorte: 0,
    pasoDeInicio: 30,
    minutosDeApartado: 10,
    minutosDeTolerancia: 30,
    duracionesEnLinea: [60, 90, 120],
  },
  whatsappNegocio: '',
}

/** Mesas que se pueden vender ahora: las del local menos las fuera de servicio. */
export function mesasEnServicio(d: ConfigDeporte): number {
  return d.mesas - d.fueraDeServicio.filter((n) => n >= 1 && n <= d.mesas).length
}

/** Precio de lista que se anuncia en la tarjeta del deporte: el de 60 minutos. */
export function precioDeLista(d: ConfigDeporte): number | undefined {
  return d.precios[60]
}

/** Las duraciones de ese deporte que se pueden reservar en línea. */
export function duracionesEnLinea(config: Configuracion, d: ConfigDeporte): Duracion[] {
  return d.duraciones.filter((m) => config.reglas.duracionesEnLinea.includes(m))
}

/** "Tablero" o "mesa": cómo se le dice a lo que se renta en cada juego. */
export const LUGAR: Record<DeporteId, { uno: string; varios: string; el: string }> = {
  pingpong: { uno: 'mesa', varios: 'mesas', el: 'la mesa' },
  cornhole: { uno: 'tablero', varios: 'tableros', el: 'el tablero' },
}

/**
 * Pone al día una configuración guardada por una versión anterior: le quita
 * los juegos que ya no existen (Popdarts) y le agrega los campos nuevos con
 * su valor por omisión. Lo guardado lo escribió OTRA versión del sitio: sin
 * esto, la primera pantalla que buscara `preciosPareja` o
 * `duracionesEnLinea` tronaría. No cambia precios ni horarios: esos los
 * decide el dueño en Ajustes.
 */
export function normalizarConfiguracion(c: Configuracion): Configuracion {
  const x = structuredClone(c) as Configuracion & { deportes: Record<string, unknown> }
  if (!x || typeof x !== 'object' || !x.deportes || typeof x.deportes !== 'object' || !x.reglas) return c
  for (const id of Object.keys(x.deportes)) if (!esDeporteVigente(id)) delete x.deportes[id]
  for (const id of ORDEN_DEPORTES) {
    const d = x.deportes[id] as (ConfigDeporte & { seDivide?: unknown }) | undefined
    if (!d) continue
    if (d.preciosPareja === undefined) d.preciosPareja = null
    if (d.precioPalasExtra === undefined) d.precioPalasExtra = null
    delete d.seDivide
  }
  if (!Array.isArray(x.reglas.duracionesEnLinea)) x.reglas.duracionesEnLinea = [...CONFIGURACION_INICIAL.reglas.duracionesEnLinea]
  delete (x.reglas as Record<string, unknown>).horasParaCancelar
  return x
}
