// Paso 3: a nombre de quién, las reglas, y pagar. "Pagar" aparta la mesa
// (10 min) y manda a pagar la parte del organizador. El resumen es el pase.

import { useState, type Dispatch } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorDeDatos, servicio } from '../../datos'
import { mensajeDeError } from '../../mecanismos/datos/usarDatos'
import { datosCompletos, type Accion, type Borrador } from '../../mecanismos/reserva/estado'
import type { Configuracion, Duracion } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import { precioDe } from '../../negocio/precios'
import { repartir } from '../../negocio/reserva'
import { IconoAtras } from '../../vista/Iconos'

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

  const { precio } = precioDe(config, deporte, inicio, duracion as Duracion)
  const montos = repartir(precio, partes)
  const listo = datosCompletos(borrador)
  const errorWhatsapp = whatsapp.length && whatsapp.length !== 10 ? 'Tienen que ser 10 dígitos.' : ''
  const r = config.reglas

  const pagar = async () => {
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
    <>
      <button type="button" className="volver" onClick={() => despachar({ tipo: 'irAPaso', paso: 2, config })}>
        <IconoAtras /> Horario
      </button>
      <div className="fila-titulo">
        <h1 className="titulo-grande">¿A nombre de quién?</h1>
      </div>

      <div className="grupo" style={{ marginTop: 14 }}>
        <div className="campo-form">
          <label htmlFor="ff-name">Nombre</label>
          <input
            type="text"
            id="ff-name"
            placeholder="Tu nombre"
            autoComplete="name"
            value={nombre}
            onChange={(e) => despachar({ tipo: 'escribirNombre', nombre: e.target.value })}
          />
        </div>
        <div className="campo-form">
          <label htmlFor="ff-wa">WhatsApp</label>
          <input
            type="tel"
            id="ff-wa"
            placeholder="10 dígitos"
            maxLength={10}
            autoComplete="tel-national"
            inputMode="numeric"
            value={whatsapp}
            aria-invalid={Boolean(errorWhatsapp)}
            aria-describedby="ff-wa-error"
            onChange={(e) => despachar({ tipo: 'escribirWhatsapp', whatsapp: e.target.value })}
          />
        </div>
      </div>
      <p className="error-campo" id="ff-wa-error">
        {errorWhatsapp}
      </p>
      <p className="nota-chica">Aquí te mandamos el link de tu reserva.</p>

      <h2 className="titulo-seccion">Antes de pagar</h2>
      <div className="grupo">
        <ul className="reglas">
          <li>Tu mesa queda apartada {r.minutosDeApartado} minutos mientras pagas.</li>
          <li>Si cancelas hasta {r.horasParaCancelar} horas antes, te devolvemos todo. Después ya no hay devolución.</li>
          <li>Hay {r.minutosDeTolerancia} minutos de tolerancia; llegar tarde no recorre tu horario.</li>
          {partes > 1 && <li>Lo que tus amigos no paguen, lo cubres tú en el local.</li>}
        </ul>
        <label className="casilla">
          <input type="checkbox" checked={aceptaReglas} onChange={(e) => despachar({ tipo: 'aceptarReglas', acepta: e.target.checked })} />
          <span>
            Acepto las reglas y el <Link to="/privacidad">aviso de privacidad</Link>.
          </span>
        </label>
      </div>

      {error && (
        <p className="aviso aviso-error" role="alert">
          {error}
        </p>
      )}

      <div className="barra-accion">
        <button type="button" className="boton boton-principal" disabled={!listo || enviando} onClick={pagar}>
          {enviando ? 'Apartando tu mesa…' : `Pagar ${formatoDinero(montos[0])}`}
        </button>
      </div>
    </>
  )
}
