// Todo lo del negocio que Hugo puede cambiar desde el panel: mesas, precios,
// promo, horario y días cerrados, más las reglas de reserva (RESERVAS.md).
//
// CONFIGURACION_INICIAL es con lo que arranca el sitio. Desde que hay panel, la
// configuración vigente vive en los datos (hoy el navegador, después Supabase)
// y ESTE archivo solo se usa la primera vez. Si cambias un precio aquí y no se
// ve, es porque ya hay una configuración guardada: se cambia desde el panel.

export type DeporteId = 'pingpong' | 'cornhole' | 'popdarts'
export type Duracion = 30 | 60 | 90 | 120

/** En cuántas partes se divide el pago: 1 = una persona paga todo. */
export type Partes = 1 | 2 | 4

export interface ConfigDeporte {
  nombre: string
  /** Prefijo de la mesa en el panel: "PP 3", "CH 5". */
  clave: string
  icono: 'paleta' | 'costal' | 'diana'
  /** Cuántas mesas hay en el local. */
  mesas: number
  /** Números de las mesas fuera de servicio (1 = la primera). No se venden. */
  fueraDeServicio: number[]
  duraciones: Duracion[]
  /** Precio por mesa, sin importar cuántos jueguen. */
  precios: Partial<Record<Duracion, number>>
  /** Precio con promo (solo para la duración de la promo). Sin él, no hay promo. */
  precioPromo: number | null
  /** Si se puede pagar entre 2 o entre 4. Popdarts se paga completo. */
  seDivide: boolean
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
    /** Cada cuántos minutos se puede empezar. */
    pasoDeInicio: number
    /** Cuánto se aparta la mesa mientras se paga. */
    minutosDeApartado: number
    /** Después de cuántos minutos sin llegar se puede liberar la mesa. */
    minutosDeTolerancia: number
    /** Reservas activas por número de WhatsApp. */
  }
  /** WhatsApp del negocio, 10 dígitos. Vacío = todavía no lo da Hugo. */
  whatsappNegocio: string
}

export const ORDEN_DEPORTES: readonly DeporteId[] = ['pingpong', 'cornhole', 'popdarts']

const h = (horas: number, minutos = 0) => horas * 60 + minutos
const TARDE: Bloque = { desde: h(17), hasta: h(22) }
const MANANA: Bloque = { desde: h(9), hasta: h(12) }

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
      precioPromo: 120,
      seDivide: true,
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
      precios: { 60: 300, 90: 440, 120: 560 },
      precioPromo: 240,
      seDivide: true,
      avisarDesde: 3,
    },
    popdarts: {
      nombre: 'Popdarts',
      clave: 'PD',
      icono: 'diana',
      mesas: 3,
      fueraDeServicio: [],
      duraciones: [60, 90, 120],
      precios: { 60: 120, 90: 180, 120: 240 },
      precioPromo: null,
      seDivide: false,
      avisarDesde: 1,
    },
  },
  horario: {
    0: [MANANA, TARDE],
    1: [TARDE],
    2: [TARDE],
    3: [TARDE],
    4: [TARDE],
    5: [TARDE],
    6: [MANANA, TARDE],
  },
  diasCerrados: [],
  promo: { activa: true, inicios: [h(17), h(17, 30)], duracion: 60 },
  reglas: {
    diasDeAnticipacion: 7,
    minutosDeCorte: 30,
    pasoDeInicio: 30,
    minutosDeApartado: 10,
    minutosDeTolerancia: 30,
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
