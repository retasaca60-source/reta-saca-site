// El pase de la reserva, con forma de boleto de avión: arriba el juego y el
// estado; en medio "salida → llegada", que aquí es la hora de inicio y la de
// fin con el día y la duración sobre un arco punteado; al centro la foto del
// juego; y abajo, pasando la perforación, el talón con el nombre, el folio y
// el total. Sale en mi reserva (/r/) y en el link de cobro (/c/).

import type { Configuracion, DeporteId } from '../negocio/configuracion'
import { formatoDinero } from '../negocio/formato'
import { formatoDuracion, formatoHora } from '../negocio/tiempo'
import { FOTO_PASE } from './fotos'
import { IconoDeporte } from './IconoDeporte'
import './pase.css'

export interface DatosDelPase {
  deporteId: DeporteId
  deporte: string
  /** "Hoy", "Mañana" o "Sáb 3/10". */
  dia: string
  /** Minutos desde medianoche. */
  inicio: number
  /** Minutos. */
  duracion: number
  titular: string
  total: number
  folio: string
  /** Texto de estado en la cabeza del pase ("Confirmada", "Apartada hasta…"). */
  estado: string
  /** Pase apagado (cancelado). */
  apagado?: boolean
}

/** "7:00 PM" → ["7:00", "PM"]: la hora va grande y el AM/PM chico, como el código del aeropuerto y su ciudad. */
const partir = (minutos: number) => formatoHora(minutos % (24 * 60)).split(' ')

export function Pase({ datos: d, config }: { datos: DatosDelPase; config: Configuracion }) {
  const [horaInicio, sufijoInicio] = partir(d.inicio)
  const [horaFin, sufijoFin] = partir(d.inicio + d.duracion)
  const foto = FOTO_PASE[d.deporteId]

  return (
    <section
      className={'pase' + (d.apagado ? ' apagado' : '')}
      aria-label={`Pase de ${d.deporte}, ${d.dia} de ${horaInicio} ${sufijoInicio} a ${horaFin} ${sufijoFin}, folio ${d.folio}`}
    >
      <div className="pase-cuerpo">
        <header className="pase-cabeza">
          <span className="pase-deporte">{d.deporte}</span>
          <span className="pase-estado">{d.estado}</span>
        </header>

        <div className="pase-ruta numeros">
          <div className="pase-extremo">
            <span className="pase-etiqueta">Inicio</span>
            <span className="pase-hora">{horaInicio}</span>
            <span className="pase-sufijo">{sufijoInicio}</span>
          </div>

          <div className="pase-trayecto" aria-hidden="true">
            <span className="pase-dia">{d.dia}</span>
            <span className="pase-arco">
              <svg viewBox="0 0 120 34" preserveAspectRatio="none">
                <path d="M4 30 Q60 -8 116 30" />
              </svg>
              <span className="pase-icono">
                <IconoDeporte id={d.deporteId} config={config} />
              </span>
            </span>
            <span className="pase-duracion">{formatoDuracion(d.duracion)}</span>
          </div>

          <div className="pase-extremo derecha">
            <span className="pase-etiqueta">Fin</span>
            <span className="pase-hora">{horaFin}</span>
            <span className="pase-sufijo">{sufijoFin}</span>
          </div>
        </div>

        <div className="pase-foto" aria-hidden="true">
          <img src={foto.src} alt="" style={{ objectPosition: foto.enfoque }} />
        </div>
      </div>

      <footer className="pase-talon">
        <div className="pase-campo">
          <span className="pase-etiqueta">A nombre de</span>
          <span className="pase-valor">{d.titular}</span>
          <span className="pase-etiqueta">Folio</span>
          <span className="pase-folio numeros">{d.folio}</span>
        </div>
        <div className="pase-campo derecha">
          <span className="pase-etiqueta">Total por la mesa</span>
          <span className="pase-total numeros">{formatoDinero(d.total)}</span>
        </div>
      </footer>
    </section>
  )
}
