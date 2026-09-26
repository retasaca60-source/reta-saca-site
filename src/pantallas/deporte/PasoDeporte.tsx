// Paso 1: qué deporte y cuántos jugadores.

import type { Dispatch } from 'react'
import { DEPORTES, ORDEN_DEPORTES, type DeporteId } from '../../negocio/catalogo'
import { formatoDinero } from '../../negocio/formato'
import { precioDeLista } from '../../negocio/precios'
import type { Accion, Reserva } from '../../mecanismos/reserva/estado'
import { IconoPalomita } from '../../vista/Iconos'
import './deporte.css'

interface Props {
  reserva: Reserva
  despachar: Dispatch<Accion>
}

export function PasoDeporte({ reserva, despachar }: Props) {
  const { deporte, personas } = reserva
  const puedeSeguir = Boolean(deporte && personas)

  return (
    <div className="screen">
      <div className="card">
        <h2 className="section-title">Elige tu deporte</h2>
        <div className="sport-grid">
          {ORDEN_DEPORTES.map((id) => {
            const d = DEPORTES[id]
            const elegido = deporte === id
            return (
              <button
                key={id}
                type="button"
                className={'sport-tile' + (elegido ? ' selected' : '')}
                aria-pressed={elegido}
                onClick={() => despachar({ tipo: 'elegirDeporte', deporte: id })}
              >
                {elegido && (
                  <span className="check">
                    <IconoPalomita tamano={12} grosor={3} />
                  </span>
                )}
                <span className="sport-icon">
                  <IconoDeporte id={id} />
                </span>
                <span>
                  <span className="sport-name">{d.nombre}</span>
                  <br />
                  <span className="sport-meta">{d.mesas} mesas</span>
                </span>
                <span className="sport-price">{formatoDinero(precioDeLista(id))} x hora</span>
              </button>
            )
          })}
        </div>
      </div>

      {deporte && (
        <div className="card">
          <h2 className="section-title">¿Cuántos jugadores?</h2>
          <p className="section-hint">{DEPORTES[deporte].pistaPersonas}</p>
          <div className="chip-row">
            {DEPORTES[deporte].personas.map((n) => {
              const recomendado = n === DEPORTES[deporte].recomendado
              return (
                <button
                  key={n}
                  type="button"
                  className={'chip' + (recomendado ? ' recommended' : '') + (personas === n ? ' selected' : '')}
                  aria-pressed={personas === n}
                  onClick={() => despachar({ tipo: 'elegirPersonas', personas: n })}
                >
                  {n} personas
                  {recomendado && <span className="badge">Recomendado</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="nav-row">
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!puedeSeguir}
          onClick={() => despachar({ tipo: 'irAPaso', paso: 2 })}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}

function IconoDeporte({ id }: { id: DeporteId }) {
  const icono = DEPORTES[id].icono
  if (icono === 'diana') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r=".8" fill="currentColor" />
      </svg>
    )
  }
  return <img src={`/imagenes/${icono}.png`} alt="" />
}
