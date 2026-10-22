// La ficha de un juego: su foto arriba y, en una hoja que sube sobre ella, todo
// lo que falta para reservar (cuántos juegan en Cornhole, día, tiempo, hora,
// palas extra en Ping Pong, nombre, reglas). Abajo, fija, la barra con el
// total y el deslizador que aparta la mesa (10 min) y manda a pagarla
// completa: desde el 21/10/2026 ya no se divide el pago.

import { useRef, useState, type Dispatch } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorDeDatos, servicio, type SolicitudDeReserva } from '../../datos'
import { mensajeDeError } from '../../mecanismos/datos/usarDatos'
import { usarAlRegresar } from '../../mecanismos/pagos/alRegresar'
import { datosCompletos, type Accion, type Borrador } from '../../mecanismos/reserva/estado'
import { queHacerConLoApartado, type ApartadoDeLaFicha } from '../../mecanismos/reserva/apartadoDeLaFicha'
import { LUGAR, mesasEnServicio, precioDeLista, type Configuracion, type Duracion } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import { precioDe, precioDePalas, tablaDe } from '../../negocio/precios'
import { ahoraEnSonora } from '../../negocio/tiempo'
import type { Reserva } from '../../negocio/reserva'
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
  // Regresó de Clip con "atrás": el deslizador vuelve a estar listo.
  usarAlRegresar(() => setEnviando(false))
  // La ficha solo se abre con el deporte elegido (ElegirJuego).
  const deporte = borrador.deporte!
  const d = config.deportes[deporte]
  const foto = FOTO_DE[deporte]
  const { fecha, duracion, inicio, nombre, whatsapp, modalidad, palasExtra } = borrador
  const lugar = LUGAR[deporte]

  const precio = inicio !== null ? precioDe(config, deporte, inicio, duracion as Duracion, modalidad).precio : null
  const palas = precioDePalas(d, palasExtra)
  const total = precio !== null ? precio + palas : null

  const volver = () => cambiarDePantalla(() => despachar({ tipo: 'irAPaso', paso: 1, config }))

  // Lo apartado en un intento anterior que no llegó a abrir el pago. Antes, si
  // apartar funcionaba y fallaba abrir el pago, reintentar apartaba OTRA mesa:
  // gastaba lugares y, con el límite de 2 apartados sin pagar por WhatsApp,
  // podía dejar al cliente sin poder reservar 10 minutos.
  const apartada = useRef<(ApartadoDeLaFicha & { reserva: Reserva }) | null>(null)
  const reservaParaPagar = async (s: SolicitudDeReserva): Promise<Reserva> => {
    const clave = JSON.stringify(s)
    const previa = apartada.current
    const decision = queHacerConLoApartado(previa, clave, ahoraEnSonora().ms)
    if (decision.tipo === 'reusar' && previa) return previa.reserva
    apartada.current = null
    // Cambió algo (otra hora, otro nombre) y nunca se abrió el pago: se suelta la mesa de antes.
    if (decision.tipo === 'nueva' && decision.cancelar) servicio.cancelarComoCliente(decision.cancelar).catch(() => {})
    const reserva = await servicio.apartar(s)
    apartada.current = { clave, reserva, apartadaHasta: reserva.apartadaHasta, tokenPrivado: reserva.tokenPrivado, pagoAbierto: false }
    return reserva
  }

  const pagar = async () => {
    if (inicio === null || !datosCompletos(borrador) || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const reserva = await reservaParaPagar({ deporte, fecha, inicio, duracion, modalidad, palasExtra, organizador: { nombre, whatsapp } })
      const { url } = await servicio.iniciarPago(reserva.tokenPrivado, [reserva.partes[0].id], nombre)
            // Desde aquí pudo pagarse: ya no se cancela aunque cambie algo.
      if (apartada.current) apartada.current.pagoAbierto = true
      // Se conserva lo apartado: si regresa de Clip sin pagar y vuelve
      // a deslizar, paga la MISMA reserva. Antes apartaba otra mesa y la
      // primera se quedaba ocupada hasta vencer.
      // Clip vive en otro dominio; la simulación, en este sitio.
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
          {mesasEnServicio(d)} {mesasEnServicio(d) === 1 ? lugar.uno : lugar.varios}
        </span>
      </div>

      <section className="ficha-hoja">
                <h1 className="ficha-titulo">{d.nombre}</h1>

        {/* Cornhole se juega 2 vs 2 (estándar) o 1 vs 1, con otro precio. Se
            elige antes del horario: las horas muestran el precio de la modalidad. */}
        {d.preciosPareja && (
          <>
            <h2 className="titulo-seccion">¿Cuántos juegan?</h2>
            <div className="segmentado" role="group" aria-label="Cuántos juegan">
              {(
                [
                  ['estandar', '4 personas'],
                  ['pareja', '2 personas'],
                ] as const
              ).map(([m, texto]) => (
                <button key={m} type="button" aria-pressed={modalidad === m} onClick={() => despachar({ tipo: 'elegirModalidad', modalidad: m })}>
                  {texto}
                  <span className="dividir-monto"> · {formatoDinero(tablaDe(d, m)[60] ?? 0)}/h</span>
                </button>
              ))}
            </div>
          </>
        )}

        <SeccionHorario
          borrador={borrador}
          despachar={despachar}
          config={config}
          deporte={deporte}
        />

        {/* Ping Pong trae 2 palas; para jugar dobles se rentan 2 más. */}
        {d.precioPalasExtra !== null && (
          <>
            <h2 className="titulo-seccion">Palas</h2>
            <div className="grupo">
              <label className="casilla">
                <input type="checkbox" checked={palasExtra} onChange={(e) => despachar({ tipo: 'pedirPalas', palasExtra: e.target.checked })} />
                <span>
                  Agregar 2 palas extra <b className="numeros">+{formatoDinero(d.precioPalasExtra)}</b>
                </span>
              </label>
            </div>
            <p className="nota">La {lugar.uno} incluye 2 palas.</p>
          </>
        )}

        <p className="nota">
          El precio es por {lugar.uno}. Se paga completo al reservar.
        </p>

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
          <b>{formatoDinero(total ?? (tablaDe(d, modalidad)[60] ?? precioDeLista(d) ?? 0) + palas)}</b>
          <span>{total === null ? 'la hora' : palas ? `${lugar.el} y palas` : `por ${lugar.el}`}</span>
        </div>
        <Deslizar
          etiqueta={enviando ? `Apartando tu ${lugar.uno}…` : (queFalta(borrador) ?? 'Desliza para pagar')}
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
