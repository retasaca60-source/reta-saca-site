// Dentro de la ficha: a nombre de quién, su WhatsApp y las reglas que se
// aceptan antes de pagar.

import type { Dispatch } from 'react'
import { Link } from 'react-router-dom'
import type { Accion, Borrador } from '../../mecanismos/reserva/estado'
import type { Configuracion } from '../../negocio/configuracion'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

export function SeccionDatos({ borrador, despachar, config }: Props) {
  const { nombre, whatsapp, aceptaReglas, partes } = borrador
  const errorWhatsapp = whatsapp.length && whatsapp.length !== 10 ? 'Tienen que ser 10 dígitos.' : ''
  const r = config.reglas

  return (
    <>
      <h2 className="titulo-seccion">¿A nombre de quién?</h2>
      <div className="grupo">
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
          {partes !== null && partes > 1 && <li>Lo que tus amigos no paguen, lo cubres tú en el local.</li>}
        </ul>
        <label className="casilla">
          <input type="checkbox" checked={aceptaReglas} onChange={(e) => despachar({ tipo: 'aceptarReglas', acepta: e.target.checked })} />
          <span>
            Acepto las reglas y el <Link to="/privacidad">aviso de privacidad</Link>.
          </span>
        </label>
      </div>
    </>
  )
}
