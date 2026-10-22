// Al regresar de Clip, la URL trae el id del intento de pago (?intento=…). Se
// manda al servidor para que registre el cobro en ese momento: el aviso de
// Clip puede llegar segundos después, y mientras tanto la persona vería su
// mesa como "apartada" justo después de pagar. El servidor no le cree al
// navegador: busca el cobro de ese intento y le pregunta a Clip si se pagó y
// por cuánto.

import { servicio } from '../../datos'

export function intentoAlVolver(busqueda: URLSearchParams): string | null {
  return busqueda.get('intento')
}

/**
 * Los intentos que ya se registraron desde esta página. La pantalla se
 * recarga cada 30 segundos con el mismo intento en la dirección, y sin esto
 * cada recarga le volvía a preguntar a Clip por el mismo cobro.
 */
const yaRegistrados = new Set<string>()

/**
 * Registra el cobro si viene un intento, una sola vez. Si falla, la página se
 * carga igual y se reintenta en la siguiente recarga: el aviso de Clip lo
 * registra después, y es mejor ver la reserva que un error.
 */
export async function registrarAlVolver(intentoId: string | null): Promise<void> {
  if (!intentoId || yaRegistrados.has(intentoId)) return
  try {
    await servicio.verificarPagoEnLinea(intentoId)
    yaRegistrados.add(intentoId)
  } catch (e) {
    console.warn('No se pudo registrar el pago al volver; llegará con el aviso de Clip.', e)
  }
}
