// Las formas de datos que entran y salen de las operaciones del negocio.
// Viven aquí (y no en datos/contrato.ts) porque las reglas las necesitan y
// las reglas no dependen de los datos: el contrato las toma de aquí.

import type { DeporteId, Duracion, Modalidad } from '../configuracion'
import type { MedioDePago, Reserva } from '../reserva'

export interface HorarioDisponible {
  /** Minutos desde medianoche en Sonora. */
  inicio: number
  /** Mesas libres en TODO el tramo (0 = lleno). */
  libres: number
  precio: number
  conPromo: boolean
}

/** Una reserva en línea. Se paga siempre completa (desde el 21/10/2026 ya no se divide). */
export interface SolicitudDeReserva {
  deporte: DeporteId
  fecha: string
  inicio: number
  duracion: Duracion
  /** Cornhole para 2 personas. Sin el campo = estándar. */
  modalidad?: Modalidad
  /** Ping Pong: 2 palas extra. */
  palasExtra?: boolean
  organizador: { nombre: string; whatsapp: string }
}

/**
 * Lo que ve quien abre el link de cobro. NO trae el WhatsApp del organizador
 * ni el link privado: el link de cobro se reenvía por grupos de WhatsApp y lo
 * puede abrir cualquiera.
 */
export interface VistaDeCobro {
  folio: string
  deporte: DeporteId
  fecha: string
  inicio: number
  duracion: number
  precio: number
  organizador: string
  estado: Reserva['estado']
  partes: { id: string; monto: number; pagada: boolean; nombre: string | null; delOrganizador: boolean; enProceso?: boolean }[]
}

/** Un grupo que llega al mostrador sin reserva. Se cobra AL REGISTRARLO. */
export interface ClienteSinReserva {
  deporte: DeporteId
  duracion: Duracion
  nombre: string
  whatsapp?: string
  /** Mesa donde se sientan, si recepción ya la sabe. */
  mesa?: string
  /** Cómo pagó en el mostrador. El comprobante es el ticket de la terminal. */
  medio: Exclude<MedioDePago, 'en_linea'>
  /** Cornhole para 2 personas. Sin el campo = estándar. */
  modalidad?: Modalidad
  /** Ping Pong: 2 palas extra. */
  palasExtra?: boolean
  /**
   * El total que recepción vio en pantalla y cobró en mano. Si el servidor
   * calcula otro (cambió la tarifa, terminó la promo, el reloj de la laptop
   * va desfasado), no registra nada y pide revisar: lo cobrado y lo guardado
   * tienen que ser lo mismo.
   */
  precioEsperado?: number
}

/** Lo que cuesta AHORA un grupo sin reserva, según la hora del servidor. */
export interface CotizacionSinReserva {
  /** De la mesa. */
  precio: number
  /** De las palas extra (0 si no se pidieron). */
  palasExtra: number
  /** Lo que se cobra: mesa más palas. Es lo que se compara con `precioEsperado`. */
  total: number
  conPromo: boolean
  /** Minuto (Sonora) en que empezarían: la hora del servidor, no la del aparato. */
  inicio: number
}

/** Un pago hecho en un día, para el cierre de caja. */
export interface PagoDelDia {
  reservaId: string
  folio: string
  deporte: DeporteId
  parteId: string
  monto: number
  medio: MedioDePago
  nombre: string
  /** Instante ISO del pago. */
  en: string
  marcadoPor?: string
  devuelto: boolean
}

/**
 * Un horario donde, con la configuración nueva, habría más reservas que
 * mesas; o, si trae `mesa`, un grupo sentado en una mesa que dejaría de existir
 * o de funcionar.
 */
export interface Conflicto {
  deporte: DeporteId
  fecha: string
  inicio: number
  reservas: number
  mesas: number
  mesa?: string
  /** Del grupo de esa mesa. */
  nombre?: string
}
