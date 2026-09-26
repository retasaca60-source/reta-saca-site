// Paso 3: nombre, WhatsApp y el resumen de lo que se va a pagar.

import type { Dispatch } from 'react'
import { DEPORTES } from '../../negocio/catalogo'
import { folioDeReserva, mesaLibre } from '../../negocio/disponibilidad'
import { esDomingo, etiquetaFecha, formatoDinero, formatoHora } from '../../negocio/formato'
import { anticipoPara, esHorarioPromo, precioPara, sePagaTodoAlReservar } from '../../negocio/precios'
import { datosCompletos, type Accion, type Reserva } from '../../mecanismos/reserva/estado'

interface Props {
  reserva: Reserva
  despachar: Dispatch<Accion>
}

export function PasoDatos({ reserva, despachar }: Props) {
  const { dia, duracion, nombre, whatsapp } = reserva
  // Este paso solo se abre con deporte, personas y hora elegidos (los pasos anteriores no dejan seguir sin ellos).
  const deporte = reserva.deporte!
  const personas = reserva.personas!
  const hora = reserva.hora!

  const promo = esHorarioPromo(deporte, esDomingo(dia), hora, duracion)
  const total = precioPara(deporte, personas, duracion, promo)
  const alReservar = anticipoPara(deporte, duracion, total)
  const todoAhora = sePagaTodoAlReservar(deporte, duracion)
  const listo = datosCompletos(reserva)
  const errorWhatsapp = whatsapp.length && whatsapp.length !== 10 ? 'Debe tener 10 dígitos.' : ''

  const confirmar = () => {
    if (!listo) return
    despachar({ tipo: 'confirmar', mesa: mesaLibre(deporte, dia, hora), folio: folioDeReserva() })
  }

  return (
    <div className="screen">
      <div className="card">
        <h2 className="section-title">Tus datos</h2>
        <p className="section-hint">Para confirmar tu reserva.</p>

        <label className="field-label" htmlFor="ff-name">
          Nombre
        </label>
        <input
          type="text"
          id="ff-name"
          placeholder="Tu nombre"
          autoComplete="name"
          value={nombre}
          onChange={(e) => despachar({ tipo: 'escribirNombre', nombre: e.target.value })}
        />

        <label className="field-label" htmlFor="ff-wa">
          WhatsApp (10 dígitos)
        </label>
        <input
          type="tel"
          id="ff-wa"
          placeholder="6621234567"
          maxLength={10}
          autoComplete="tel-national"
          inputMode="numeric"
          value={whatsapp}
          aria-invalid={Boolean(errorWhatsapp)}
          aria-describedby="ff-wa-error"
          onChange={(e) => despachar({ tipo: 'escribirWhatsapp', whatsapp: e.target.value })}
        />
        <div className="error-text" id="ff-wa-error">
          {errorWhatsapp}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Resumen</h2>
        <Fila etiqueta="Deporte" valor={`${DEPORTES[deporte].nombre} · ${personas} personas`} />
        <Fila etiqueta="Fecha" valor={etiquetaFecha(dia)} />
        <Fila etiqueta="Horario" valor={`${formatoHora(hora)} · ${duracion} min`} />
        {promo && (
          <div className="summary-row">
            <span className="label">Promo aplicada</span>
            <span className="value" style={{ color: 'var(--teal)' }}>
              Sí
            </span>
          </div>
        )}
        <div className="summary-total">
          <span className="label">Total</span>
          <span className="value">{formatoDinero(total)}</span>
        </div>

        <div className="split-note">
          <div className="split-box now">
            <div className="k">{todoAhora ? 'Se paga ahora' : 'Anticipo'}</div>
            <div className="v">{formatoDinero(alReservar)}</div>
          </div>
          <div className="split-box">
            <div className="k">En el lugar</div>
            <div className="v">{formatoDinero(total - alReservar)}</div>
          </div>
        </div>
      </div>

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => despachar({ tipo: 'irAPaso', paso: 2 })}>
          Atrás
        </button>
        <button type="button" className="btn btn-primary" disabled={!listo} onClick={confirmar}>
          Confirmar reserva
        </button>
      </div>
    </div>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="summary-row">
      <span className="label">{etiqueta}</span>
      <span className="value">{valor}</span>
    </div>
  )
}
