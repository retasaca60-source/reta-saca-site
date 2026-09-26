// Paso 4: la reserva quedó hecha. Folio, mesa y a nombre de quién.

import type { Dispatch } from 'react'
import { DEPORTES } from '../../negocio/catalogo'
import { etiquetaFecha, formatoHora, whatsappLegible } from '../../negocio/formato'
import type { Accion, Reserva } from '../../mecanismos/reserva/estado'
import { IconoPalomita } from '../../vista/Iconos'
import './reserva-lista.css'

interface Props {
  reserva: Reserva
  despachar: Dispatch<Accion>
}

export function ReservaLista({ reserva, despachar }: Props) {
  const { dia, nombre, whatsapp, folio, mesa } = reserva
  // Solo se llega aquí confirmando, con deporte y hora ya elegidos.
  const deporte = reserva.deporte!
  const hora = reserva.hora!

  return (
    <div className="card success-wrap screen">
      <div className="success-icon">
        <IconoPalomita tamano={28} grosor={2.4} />
      </div>
      <div className="success-title">¡Reserva lista!</div>
      <p className="section-hint">
        {DEPORTES[deporte].nombre} · {etiquetaFecha(dia)} · {formatoHora(hora)}
      </p>
      <div className="code-box">{folio}</div>
      <div className="summary-row">
        <span className="label">Mesa asignada</span>
        <span className="value">{mesa}</span>
      </div>
      <div className="summary-row">
        <span className="label">A nombre de</span>
        <span className="value">{nombre}</span>
      </div>
      {/* Se cambia por la confirmación real cuando se mande el WhatsApp de verdad. */}
      <div className="section-hint" style={{ marginTop: 14 }}>
        Te confirmamos por WhatsApp al {whatsappLegible(whatsapp)}. Ejemplo de confirmación — ningún mensaje real fue enviado.
      </div>
      <button type="button" className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => despachar({ tipo: 'otraReserva' })}>
        Hacer otra reserva
      </button>
    </div>
  )
}
