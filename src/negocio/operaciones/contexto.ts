// Lo que toda operación necesita saber del mundo.

import type { Configuracion } from '../configuracion'
import { pagadoEnLinea, type Reserva } from '../reserva'

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
 * Al cancelar una COPIA: si hubo pagos en línea, la devolución queda por
 * revisar y la decide el negocio. Lo cobrado en el local no entra: eso se
 * arregla en persona y ya está cuadrado en la caja de su día.
 */
export function abrirDevolucion(r: Reserva): void {
  const monto = pagadoEnLinea(r)
  r.devolucion = monto > 0 ? { monto, estado: 'por_revisar' } : null
}
