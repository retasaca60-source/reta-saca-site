// Paso 1: qué deporte y cómo van a pagar (todo, entre 2 o entre 4).

import type { Dispatch } from 'react'
import { mesasEnServicio, ORDEN_DEPORTES, precioDeLista, type Configuracion, type DeporteId, type Partes } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import type { Accion, Borrador } from '../../mecanismos/reserva/estado'
import { IconoPalomita } from '../../vista/Iconos'
import './deporte.css'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

const FORMAS: { partes: Partes; nombre: string }[] = [
  { partes: 1, nombre: 'Pago completo' },
  { partes: 2, nombre: 'Entre 2' },
  { partes: 4, nombre: 'Entre 4' },
]

export function PasoDeporte({ borrador, despachar, config }: Props) {
  const { deporte, partes } = borrador
  const puedeSeguir = Boolean(deporte && partes)

  return (
    <div className="screen">
      <div className="card">
        <h2 className="section-title">Elige tu deporte</h2>
        <div className="sport-grid">
          {ORDEN_DEPORTES.map((id) => {
            const d = config.deportes[id]
            const elegido = deporte === id
            const precio = precioDeLista(d)
            return (
              <button
                key={id}
                type="button"
                className={'sport-tile' + (elegido ? ' selected' : '')}
                aria-pressed={elegido}
                onClick={() => despachar({ tipo: 'elegirDeporte', deporte: id, config })}
              >
                {elegido && (
                  <span className="check">
                    <IconoPalomita tamano={12} grosor={3} />
                  </span>
                )}
                <span className="sport-icon">
                  <IconoDeporte id={id} config={config} />
                </span>
                <span>
                  <span className="sport-name">{d.nombre}</span>
                  <br />
                  <span className="sport-meta">{mesasEnServicio(d)} mesas</span>
                </span>
                {precio !== undefined && <span className="sport-price">{formatoDinero(precio)} x hora</span>}
              </button>
            )
          })}
        </div>
      </div>

      {deporte && config.deportes[deporte].seDivide && (
        <div className="card">
          <h2 className="section-title">¿Cómo van a pagar?</h2>
          <p className="section-hint">
            El precio es por mesa, jueguen 2 o 4. Si lo dividen, tú pagas tu parte al reservar y mandas un link a tus amigos para
            que paguen la suya (o la pagan en el local).
          </p>
          <div className="chip-row">
            {FORMAS.map((f) => (
              <button
                key={f.partes}
                type="button"
                className={'chip' + (partes === f.partes ? ' selected' : '')}
                aria-pressed={partes === f.partes}
                onClick={() => despachar({ tipo: 'elegirPartes', partes: f.partes })}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {deporte && !config.deportes[deporte].seDivide && (
        <div className="card">
          <p className="section-hint" style={{ margin: 0 }}>
            {config.deportes[deporte].nombre} se paga completo al reservar.
          </p>
        </div>
      )}

      <div className="nav-row">
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" disabled={!puedeSeguir} onClick={() => despachar({ tipo: 'irAPaso', paso: 2, config })}>
          Continuar
        </button>
      </div>
    </div>
  )
}

export function IconoDeporte({ id, config }: { id: DeporteId; config: Configuracion }) {
  const icono = config.deportes[id].icono
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
