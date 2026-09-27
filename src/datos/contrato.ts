// EL CONTRATO entre las pantallas y los datos.
//
// Las pantallas solo hablan con un `ServicioDeDatos`. Hoy lo cumple
// `simulado.ts` (guarda en el navegador); la versión real (Supabase + Mercado
// Pago) tiene que cumplir EXACTAMENTE estas mismas funciones, con los mismos
// errores. Así se cambia una por otra sin tocar una sola pantalla.
//
// La explicación completa, para quien haga la versión real, está en
// CONTRATO-DE-DATOS.md, incluido qué tiene que garantizar el servidor (y no el
// navegador).

import type { Configuracion, DeporteId, Duracion, Partes } from '../negocio/configuracion'
import type { MedioDePago, Reserva } from '../negocio/reserva'

// ─── Lo que ve el cliente ────────────────────────────────────────────────

export interface HorarioDisponible {
  /** Minutos desde medianoche en Sonora. */
  inicio: number
  /** Mesas libres en TODO el tramo (0 = lleno). */
  libres: number
  precio: number
  conPromo: boolean
}

export interface SolicitudDeReserva {
  deporte: DeporteId
  fecha: string
  inicio: number
  duracion: Duracion
  partes: Partes
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
  partes: { id: string; monto: number; pagada: boolean; nombre: string | null; delOrganizador: boolean }[]
}

// ─── Lo que usa el panel ─────────────────────────────────────────────────

export type Rol = 'dueno' | 'recepcion'

export interface Usuario {
  id: string
  nombre: string
  correo: string
  rol: Rol
}

export interface ClienteSinReserva {
  deporte: DeporteId
  duracion: Duracion
  nombre: string
  whatsapp?: string
  /** Mesa donde se sientan, si recepción ya la sabe. */
  mesa?: string
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

/** Un horario donde, con la configuración nueva, habría más reservas que mesas. */
export interface Conflicto {
  deporte: DeporteId
  fecha: string
  inicio: number
  reservas: number
  mesas: number
}

// ─── Errores ─────────────────────────────────────────────────────────────

export type CodigoDeError =
  | 'sin_lugar' // ya no hay mesa en ese horario
  | 'fuera_de_horario' // cerrado, fuera de la ventana de 7 días o pasado el corte
  | 'limite_whatsapp' // ese WhatsApp ya tiene el máximo de reservas activas
  | 'datos_invalidos'
  | 'no_encontrada'
  | 'no_permitido' // p. ej. cancelar con devolución fuera de plazo, o recepción editando precios
  | 'apartado_vencido' // se tardó más de 10 min en pagar y la mesa ya no está
  | 'sin_sesion'

/** Todos los errores esperados del servicio son de este tipo: la pantalla muestra `message`. */
export class ErrorDeDatos extends Error {
  readonly codigo: CodigoDeError
  constructor(codigo: CodigoDeError, mensaje: string) {
    super(mensaje)
    this.codigo = codigo
    this.name = 'ErrorDeDatos'
  }
}

// ─── El contrato ─────────────────────────────────────────────────────────

export interface ServicioDeDatos {
  /** 'simulado' o 'real'. Las pantallas lo usan solo para mostrar avisos de demostración. */
  readonly modo: 'simulado' | 'real'

  // Cliente
  configuracion(): Promise<Configuracion>
  disponibilidad(deporte: DeporteId, fecha: string, duracion: Duracion): Promise<HorarioDisponible[]>
  /** Crea la reserva APARTADA (10 min) con sus partes. Revalida todo del lado de los datos. */
  apartar(solicitud: SolicitudDeReserva): Promise<Reserva>
  /**
   * Empieza un pago en línea de una o varias partes. Devuelve la URL a la que
   * hay que mandar al cliente (Mercado Pago, o la pantalla simulada).
   * `token` es el privado del organizador o el del link de cobro.
   */
  iniciarPago(token: string, parteIds: string[], nombre: string): Promise<{ url: string }>
  reservaPorTokenPrivado(token: string): Promise<Reserva | null>
  vistaDeCobro(tokenCobro: string): Promise<VistaDeCobro | null>
  /** Cancela desde el link privado. Con devolución solo hasta N horas antes. */
  cancelarComoCliente(tokenPrivado: string): Promise<Reserva>

  // Panel
  sesion(): Promise<Usuario | null>
  iniciarSesion(correo: string, contrasena: string): Promise<Usuario>
  cerrarSesion(): Promise<void>
  /** Reservas entre dos fechas "AAAA-MM-DD" (incluidas), de todos los estados. */
  reservasEntre(desde: string, hasta: string): Promise<Reserva[]>
  /** Pagos HECHOS ese día (en línea y en el local), no los de las reservas de ese día. Para el cierre de caja. */
  pagosDelDia(fecha: string): Promise<PagoDelDia[]>
  anotarSinReserva(cliente: ClienteSinReserva): Promise<Reserva>
  /** Asigna mesa y marca que llegaron. `null` quita la mesa. */
  asignarMesa(reservaId: string, mesa: string | null): Promise<Reserva>
  marcarPago(reservaId: string, parteIds: string[], medio: Exclude<MedioDePago, 'en_linea'>, nombre?: string): Promise<Reserva>
  extender(reservaId: string, minutos: Duracion): Promise<Reserva>
  cambiarHorario(reservaId: string, fecha: string, inicio: number): Promise<Reserva>
  /** Cancelación del negocio: devuelve TODO lo pagado en línea, sin plazo. */
  cancelarComoNegocio(reservaId: string): Promise<Reserva>
  /** Pasada la tolerancia sin llegar: libera la mesa, sin devolución. */
  liberarPorRetraso(reservaId: string): Promise<Reserva>
  /** Solo el dueño. Sin `aunqueHayaConflictos`, si hay conflictos NO guarda y los devuelve. */
  guardarConfiguracion(config: Configuracion, aunqueHayaConflictos?: boolean): Promise<{ guardada: boolean; conflictos: Conflicto[] }>
  usuarios(): Promise<Usuario[]>
  agregarUsuario(u: Omit<Usuario, 'id'>): Promise<Usuario>
  quitarUsuario(id: string): Promise<void>

  /** Avisa cuando cambian los datos (otra pestaña, otro aparato). Devuelve cómo dejar de escuchar. */
  alCambiar(aviso: () => void): () => void
}
