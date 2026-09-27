// Paso 3: nombre, WhatsApp, reglas y resumen. "Ir a pagar" aparta la mesa
// (10 min) y manda a pagar la parte del organizador.

import { useState, type Dispatch } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorDeDatos, servicio } from '../../datos'
import { mensajeDeError } from '../../mecanismos/datos/usarDatos'
import { datosCompletos, type Accion, type Borrador } from '../../mecanismos/reserva/estado'
import type { Configuracion, Duracion } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import { precioDe } from '../../negocio/precios'
import { repartir } from '../../negocio/reserva'
import { etiquetaFecha, formatoDuracion, formatoHora } from '../../negocio/tiempo'
import { Fila } from '../../vista/Fila'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

export function PasoDatos({ borrador, despachar, config }: Props) {
  const navegar = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { fecha, duracion, nombre, whatsapp, aceptaReglas } = borrador
  // Este paso solo se abre con todo lo anterior elegido.
  const deporte = borrador.deporte!
  const partes = borrador.partes!
  const inicio = borrador.inicio!

  // El precio que se muestra es orientativo: el que vale lo calcula el servicio al apartar.
  const { precio, conPromo } = precioDe(config, deporte, inicio, duracion as Duracion)
  const montos = repartir(precio, partes)
  const listo = datosCompletos(borrador)
  const errorWhatsapp = whatsapp.length && whatsapp.length !== 10 ? 'Debe tener 10 dígitos.' : ''
  const r = config.reglas

  const irAPagar = async () => {
    if (!listo || enviando) return
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
    <div className="screen">
      <div className="card">
        <h2 className="section-title">Tus datos</h2>
        <p className="section-hint">Para confirmar tu reserva y mandarte tu link.</p>

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
        <Fila etiqueta="Deporte" valor={config.deportes[deporte].nombre} />
        <Fila etiqueta="Fecha" valor={etiquetaFecha(fecha)} />
        <Fila etiqueta="Horario" valor={`${formatoHora(inicio)} · ${formatoDuracion(duracion)}`} />
        {conPromo && <Fila etiqueta="Promo aplicada" valor="Sí" color="var(--teal)" />}
        <div className="summary-total">
          <span className="label">Total por la mesa</span>
          <span className="value">{formatoDinero(precio)}</span>
        </div>

        <div className="split-note">
          <div className="split-box now">
            <div className="k">Pagas ahora</div>
            <div className="v">{formatoDinero(montos[0])}</div>
          </div>
          {partes > 1 && (
            <div className="split-box">
              <div className="k">Tus {partes - 1} amigos</div>
              <div className="v">{formatoDinero(montos[1])} c/u</div>
            </div>
          )}
        </div>
        {partes > 1 && (
          <p className="section-hint" style={{ marginTop: 12, marginBottom: 0 }}>
            Al pagar te damos un link para mandarles. Pueden pagar ahí o en el local. Lo que no se pague lo cubres tú.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Antes de pagar</h2>
        <ul className="reglas">
          <li>Tu mesa queda apartada {r.minutosDeApartado} minutos mientras pagas.</li>
          <li>Cancelas con devolución completa hasta {r.horasParaCancelar} horas antes. Después, no hay devolución.</li>
          <li>Tolerancia de {r.minutosDeTolerancia} minutos: si no llegas, la mesa se puede liberar. Llegar tarde no recorre tu horario.</li>
          {partes > 1 && <li>Lo que tus amigos no paguen lo cubres tú en el local.</li>}
        </ul>
        <label className="casilla">
          <input type="checkbox" checked={aceptaReglas} onChange={(e) => despachar({ tipo: 'aceptarReglas', acepta: e.target.checked })} />
          <span>
            Acepto las reglas y el <Link to="/privacidad">aviso de privacidad</Link>.
          </span>
        </label>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => despachar({ tipo: 'irAPaso', paso: 2, config })}>
          Atrás
        </button>
        <button type="button" className="btn btn-primary" disabled={!listo || enviando} onClick={irAPagar}>
          {enviando ? 'Apartando tu mesa…' : `Ir a pagar ${formatoDinero(montos[0])}`}
        </button>
      </div>
    </div>
  )
}
