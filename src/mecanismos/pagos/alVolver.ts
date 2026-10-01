// Al regresar de Mercado Pago, la URL trae el id del pago (payment_id, o
// collection_id en avisos viejos). Se manda al servidor para que lo registre en
// ese momento: el aviso de Mercado Pago puede llegar segundos después, y
// mientras tanto la persona vería su mesa como "apartada" justo después de
// pagar. El servidor no le cree al navegador: con el id le pregunta a Mercado
// Pago si se pagó y por cuánto.

import { servicio } from '../../datos'

export function pagoDeMercadoPago(busqueda: URLSearchParams): string | null {
  return busqueda.get('payment_id') ?? busqueda.get('collection_id')
}

/**
 * Registra el pago si viene uno. Si falla, la página se carga igual: el aviso
 * de Mercado Pago lo registra después, y es mejor ver la reserva que un error.
 */
export async function registrarAlVolver(pagoId: string | null): Promise<void> {
  if (!pagoId) return
  try {
    await servicio.verificarPagoEnLinea(pagoId)
  } catch (e) {
    console.warn('No se pudo registrar el pago al volver; llegará con el aviso de Mercado Pago.', e)
  }
}
