// Paso 1: a qué juegan y cómo van a pagar (uno paga todo, entre 2 o entre 4).

import type { Dispatch } from 'react'
import { mesasEnServicio, ORDEN_DEPORTES, precioDeLista, type Configuracion, type Partes } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import type { Accion, Borrador } from '../../mecanismos/reserva/estado'
import { IconoDeporte } from '../../vista/IconoDeporte'
import { IconoPalomita } from '../../vista/Iconos'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

const FORMAS: { partes: Partes; nombre: string }[] = [
  { partes: 1, nombre: 'Uno paga todo' },
  { partes: 2, nombre: 'Entre 2' },
  { partes: 4, nombre: 'Entre 4' },
]

export function PasoDeporte({ borrador, despachar, config }: Props) {
  const { deporte, partes } = borrador
  const puedeSeguir = Boolean(deporte && partes)
  const elegido = deporte ? config.deportes[deporte] : null

  return (
    <>
      <div className="fila-titulo">
        <h1 className="titulo-grande">¿A qué le entran?</h1>
      </div>

      <ul className="grupo" style={{ marginTop: 14 }}>
        {ORDEN_DEPORTES.map((id) => {
          const d = config.deportes[id]
          const precio = precioDeLista(d)
          return (
            <li key={id}>
              <button
                type="button"
                className="opcion"
                aria-pressed={deporte === id}
                onClick={() => despachar({ tipo: 'elegirDeporte', deporte: id, config })}
              >
                <span className="opcion-icono">
                  <IconoDeporte id={id} config={config} />
                </span>
                <span className="opcion-texto">
                  <strong>{d.nombre}</strong>
                  <span className="numeros">
                    {mesasEnServicio(d)} mesas{precio !== undefined && ` · ${formatoDinero(precio)} la hora`}
                  </span>
                </span>
                <span className="opcion-marca">
                  <IconoPalomita tamano={24} grosor={2} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {elegido?.seDivide && (
        <>
          <h2 className="titulo-seccion">¿Cómo pagan?</h2>
          <div className="segmentado" role="group" aria-label="Cómo pagan">
            {FORMAS.map((f) => (
              <button key={f.partes} type="button" aria-pressed={partes === f.partes} onClick={() => despachar({ tipo: 'elegirPartes', partes: f.partes })}>
                {f.nombre}
              </button>
            ))}
          </div>
          <p className="nota">
            El precio es por mesa, jueguen 2 o 4. Si lo dividen, tú pagas tu parte al reservar y les mandas un link a tus
            amigos para que paguen la suya, o la pagan en el local.
          </p>
        </>
      )}
      {elegido && !elegido.seDivide && <p className="nota">{elegido.nombre} se paga completo al reservar.</p>}

      <div className="barra-accion">
        <button type="button" className="boton boton-principal" disabled={!puedeSeguir} onClick={() => despachar({ tipo: 'irAPaso', paso: 2, config })}>
          Continuar
        </button>
      </div>
    </>
  )
}
