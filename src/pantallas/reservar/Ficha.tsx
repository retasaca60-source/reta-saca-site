// La ficha de un juego: su foto arriba y, en una hoja que sube sobre ella, todo
// lo que falta para reservar (cómo pagan, día, tiempo, hora, nombre, reglas).
// Abajo, fija, la barra con cuánto pagas y el deslizador que aparta la mesa
// (10 min) y manda a pagar la parte de quien reserva.

import { useRef, useState, type Dispatch } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorDeDatos, servicio, type SolicitudDeReserva } from '../../datos'
import { mensajeDeError } from '../../mecanismos/datos/usarDatos'
import { datosCompletos, type Accion, type Borrador } from '../../mecanismos/reserva/estado'
import { mesasEnServicio, precioDeLista, type Configuracion, type Duracion, type Partes } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import { precioDe } from '../../negocio/precios'
import { ahoraEnSonora } from '../../negocio/tiempo'
import { repartir, type Reserva } from '../../negocio/reserva'
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

  // Lo apartado en un intento anterior que no llegó a abrir el pago. Antes, si
  // apartar funcionaba y fallaba abrir el pago, reintentar apartaba OTRA mesa:
  // gastaba lugares y, con el límite de 2 apartados sin pagar por WhatsApp,
  // podía dejar al cliente sin poder reservar 10 minutos.
  const apartada = useRef<{ clave: string; reserva: Reserva } | null>(null)
  const reservaParaPagar = async (s: SolicitudDeReserva): Promise<Reserva> => {
    const clave = JSON.stringify(s)
    const previa = apartada.current
    if (previa && previa.clave === clave && (previa.reserva.apartadaHasta ?? 0) > ahoraEnSonora().ms) return previa.reserva
    if (previa) {
      // Cambió algo (otra hora, otro nombre): se suelta la mesa de antes.
      apartada.current = null
      servicio.cancelarComoCliente(previa.reserva.tokenPrivado).catch(() => {})
    }
    const reserva = await servicio.apartar(s)
    apartada.current = { clave, reserva }
    return reserva
  }

  const pagar = async () => {
    if (inicio === null || !datosCompletos(borrador) || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const reserva = await reservaParaPagar({ deporte, fecha, inicio, duracion, partes, organizador: { nombre, whatsapp } })
      const { url } = await servicio.iniciarPago(reserva.tokenPrivado, [reserva.partes[0].id], nombre)
      // Ya va a pagar: lo apartado deja de ser "pendiente de esta ficha".
      apartada.current = null
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
        <span className="pastilla ficha-mesas numeros">
  {mesasEnServicio(d)}{' '}
  {deporte === 'cornhole'
    ? mesasEnServicio(d) === 1 ? 'tablero' : 'tableros'
    : mesasEnServicio(d) === 1 ? 'mesa' : 'mesas'}
</span>
      </div>

      <section className="ficha-hoja">
                <h1 className="ficha-titulo">{d.nombre}</h1>

        <SeccionHorario
          borrador={borrador}
          despachar={despachar}
          config={config}
          deporte={deporte}
        />

        {/* La aclaración se muestra al elegir Popdarts, junto a sus horarios. */}
        {deporte === 'popdarts' && (
          <p className="nota">
            El precio es por mesa, jueguen 2 o 4.
          </p>
        )}

        {/* Primero se elige el horario y después cómo se pagará. */}
                {d.seDivide ? (
          <>
            <h2 className="titulo-seccion">¿Cómo pagan?</h2>

            <div
              className="segmentado"
              role="group"
              aria-label="Cómo pagan"
            >
              <button
                type="button"
                aria-pressed={partes === 1}
                onClick={() =>
                  despachar({ tipo: 'elegirPartes', partes: 1 })
                }
              >
                Pagar el total
              </button>

              <button
                type="button"
                aria-pressed={partes > 1}
                onClick={() =>
                  despachar({
                    tipo: 'elegirPartes',
                    partes: partes === 4 ? 4 : 2,
                  })
                }
              >
                Pagar mi parte
              </button>
            </div>

            {partes > 1 && (
              // Las mismas pastillas que "¿Cómo pagan?" y no un <select>: el menú
              // nativo de Windows rompía el diseño y la pregunta, metida en la
              // columna de 88 px de los campos, se partía palabra por palabra.
              // Cada opción dice cuánto le toca al organizador, que es lo que
              // está decidiendo.
              <div className="dividir">
                <span className="dividir-titulo" id="dividir-titulo">
                  ¿Entre cuántos dividen?
                </span>
                <div className="segmentado" role="group" aria-labelledby="dividir-titulo">
                  {([2, 4] as Partes[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={partes === n}
                      onClick={() => despachar({ tipo: 'elegirPartes', partes: n })}
                    >
                      Entre {n}
                      {precio !== null && <span className="dividir-monto"> · {formatoDinero(repartir(precio, n)[0])}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="nota">
              El precio es por{' '}
              {deporte === 'cornhole' ? 'tablero' : 'mesa'}.
              {partes > 1
                ? ' Tú pagas tu parte al reservar y les mandas un link a tus amigos; también pueden pagar en el local.'
                : ' Pagas el total al reservar.'}
            </p>
          </>
        ) : (
          <p className="nota">
            Se paga completo al reservar.
          </p>
        )}

        <SeccionDatos
          borrador={borrador}
          despachar={despachar}
          config={config}
        />

        {error && (
          <p className="aviso aviso-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className="barra-accion barra-reserva">
        <div className="barra-precio numeros">
          <b>{formatoDinero(tuParte ?? precioDeLista(d) ?? 0)}</b>
          <span>
  {tuParte === null
    ? 'la hora'
    : partes > 1
      ? 'tu parte'
      : deporte === 'cornhole'
        ? 'por el tablero'
        : 'por la mesa'}
</span>
        </div>
        <Deslizar
          etiqueta={
  enviando
    ? deporte === 'cornhole'
      ? 'Apartando tu tablero…'
      : 'Apartando tu mesa…'
    : queFalta(borrador) ?? 'Desliza para pagar'
}
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
