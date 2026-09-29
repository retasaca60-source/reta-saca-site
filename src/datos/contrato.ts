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

import type { Configuracion, DeporteId, Duracion } from '../negocio/configuracion'
import type { ClienteSinReserva, Conflicto, HorarioDisponible, PagoDelDia, SolicitudDeReserva, VistaDeCobro } from '../negocio/operaciones/tipos'
import type { MedioDePago, Reserva } from '../negocio/reserva'

// Las formas de datos y el error vienen del negocio; se reexportan para que
// las pantallas sigan importando todo de aquí.
export { ErrorDeDatos, type CodigoDeError } from '../negocio/errores'
export type {
  ClienteSinReserva,
  Conflicto,
  HorarioDisponible,
  PagoDelDia,
  SolicitudDeReserva,
  VistaDeCobro,
} from '../negocio/operaciones/tipos'

// ─── Sesión del panel ────────────────────────────────────────────────────

export type Rol = 'dueno' | 'recepcion'

export interface Usuario {
  id: string
  nombre: string
  correo: string
  rol: Rol
}

// ─── Pago simulado (mientras no hay Mercado Pago) ────────────────────────

/** Un pago en línea empezado: qué partes, a nombre de quién y a dónde regresar. */
export interface IntentoDePago {
  id: string
  reservaId: string
  parteIds: string[]
  nombre: string
  monto: number
  /** A dónde regresa al pagar o cancelar: "/r/<token>" o "/c/<token>". */
  volverA: string
  resultado: 'pagado' | 'cancelado' | null
}

/**
 * La pantalla /pago/<id> que ocupa el lugar de Mercado Pago. La tienen la
 * versión simulada y la real mientras los pagos en línea sean de prueba.
 */
export interface PagoSimulado {
  obtener(id: string): Promise<{ intento: IntentoDePago; reserva: Reserva } | null>
  /** Paga y devuelve a dónde regresar. */
  confirmar(id: string): Promise<string>
  /** Cancela y devuelve a dónde regresar. */
  rechazar(id: string): Promise<string>
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
  /** Registra Y COBRA en el mostrador a un grupo sin reserva (empieza ahora). */
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
