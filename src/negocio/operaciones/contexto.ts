// Lo que toda operación necesita saber del mundo.

import type { Configuracion } from '../configuracion'
import type { Reserva } from '../reserva'

export interface Contexto {
  config: Configuracion
  /**
   * Las reservas que pueden chocar con la operación. La versión simulada pasa
   * todas; la real basta con que pase las del mismo día y deporte, más las
   * activas del mismo WhatsApp (para el límite por WhatsApp).
   */
  reservas: readonly Reserva[]
  /** La hora actual en ms. En la versión real, la del SERVIDOR. */
  ahora: number
}

/** Copia para no modificar la reserva que entró: las operaciones regresan una nueva. */
export const copia = (r: Reserva): Reserva => structuredClone(r)

/**
 * Marca como devueltos los pagos en línea de una COPIA (la devolución real la
 * hace Mercado Pago). Interno de las operaciones: no sale en su interfaz.
 */
export function devolverPagosEnLinea(r: Reserva): void {
  for (const p of r.partes) if (p.pago?.medio === 'en_linea') p.pago.devuelto = true
}
