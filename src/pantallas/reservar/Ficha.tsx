// La ficha de un juego: su foto arriba y, en una hoja que sube sobre ella, todo
// lo que falta para reservar (cómo pagan, día, tiempo, hora, nombre, reglas).
// Abajo, fija, la barra con cuánto pagas y el deslizador que aparta la mesa
// (10 min) y manda a pagar la parte de quien reserva.

import { useState, type Dispatch } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorDeDatos, servicio } from '../../datos'
import { mensajeDeError } from '../../mecanismos/datos/usarDatos'
import { datosCompletos, type Accion, type Borrador } from '../../mecanismos/reserva/estado'
import { mesasEnServicio, precioDeLista, type Configuracion, type Duracion, type Partes } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import { precioDe } from '../../negocio/precios'
import { repartir } from '../../negocio/reserva'
import { Deslizar } from '../../vista/Deslizar'
import { FOTO_DE } from '../../vista/fotos'
import { IconoAtras } from '../../vista/Iconos'
import { IconoDeporte } from '../../vista/IconoDeporte'
import { cambiarDePantalla } from '../../vista/transicion'
import { SeccionDatos } from './SeccionDatos'
import { SeccionHorario } from './SeccionHorario'

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

export function Ficha({ borrador, despachar, config }: Props) {
  const navegar = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // La ficha solo se abre con deporte y forma de pago elegidos (ElegirJuego).
  const deporte = borrador.deporte!
  const partes = borrador.partes ?? 1
  const d = config.deportes[deporte]
  const foto = FOTO_DE[deporte]
  const { fecha, duracion, inicio, nombre, whatsapp } = borrador

  const precio = inicio !== null ? precioDe(config, deporte, inicio, duracion as Duracion).precio : null
  const tuParte = precio !== null ? repartir(precio, partes)[0] : null

  const volver = () => cambiarDePantalla(() => despachar({ tipo: 'irAPaso', paso: 1, config }))

  const pagar = async () => {
    if (inicio === null || !datosCompletos(borrador) || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const reserva = await servicio.apartar({ deporte, fecha, inicio, duracion, partes, organizador: { nombre, whatsapp } })
      const { url } = await servicio.iniciarPago(reserva.tokenPrivado, [reserva.partes[0].id], nombre)
      // Mercado Pago real vive en otro dominio; la simulación, en este sitio.
      if (url.startsWith('/')) navegar(url)
      else window.location.assign(url)
    } catch (e) {
      setEnviando(false)
      if (e instanceof ErrorDeDatos && (e.codigo === 'sin_lugar' || e.codigo === 'fuera_de_horario')) {
        despachar({ tipo: 'soltarHora', aviso: e.message })
        return
      }
      setError(mensajeDeError(e))
    }
  }

  return (
    <>
      <div className="ficha-portada">
        <img className={`ficha-foto foto-${deporte}`} src={foto.src} alt="" style={{ objectPosition: foto.enfoque }} />
        <button type="button" className="boton-redondo ficha-volver" onClick={volver} aria-label="Volver a los juegos">
          <IconoAtras />
        </button>
        <span className="pastilla ficha-mesas numeros">{mesasEnServicio(d)} mesas</span>
      </div>

      <section className="ficha-hoja">
        <h1 className="ficha-titulo">{d.nombre}</h1>

        {d.seDivide ? (
          <>
            <h2 className="titulo-seccion">¿Cómo pagan?</h2>
            <div className="segmentado" role="group" aria-label="Cómo pagan">
              {FORMAS.map((f) => (
                <button key={f.partes} type="button" aria-pressed={partes === f.partes} onClick={() => despachar({ tipo: 'elegirPartes', partes: f.partes })}>
                  {f.nombre}
                </button>
              ))}
            </div>
            <p className="nota">El precio es por mesa. Si lo dividen, tú pagas tu parte al reservar y les mandas un link a tus amigos; o la pagan en el local.</p>
          </>
        ) : (
          <p className="nota">El precio es por mesa y se paga completo al reservar.</p>
        )}

        <SeccionHorario borrador={borrador} despachar={despachar} config={config} deporte={deporte} />
        <SeccionDatos borrador={borrador} despachar={despachar} config={config} />

        {error && (
          <p className="aviso aviso-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className="barra-accion barra-reserva">
        <div className="barra-precio numeros">
          <b>{formatoDinero(tuParte ?? precioDeLista(d) ?? 0)}</b>
          <span>{tuParte === null ? 'la hora' : partes > 1 ? 'tu parte' : 'por la mesa'}</span>
        </div>
        <Deslizar
          etiqueta={enviando ? 'Apartando tu mesa…' : queFalta(borrador) ?? 'Desliza para pagar'}
          listo={queFalta(borrador) === null}
          ocupado={enviando}
          icono={<IconoDeporte id={deporte} config={config} />}
          onConfirmar={pagar}
        />
      </div>
    </>
  )
}

/** Lo siguiente que falta para poder pagar, en el orden en que se llena la ficha. */
function queFalta(b: Borrador): string | null {
  if (b.inicio === null) return 'Elige una hora'
  if (b.nombre.trim().length < 2) return 'Escribe tu nombre'
  if (b.whatsapp.length !== 10) return 'Falta tu WhatsApp'
  if (!b.aceptaReglas) return 'Acepta las reglas'
  return null
}
