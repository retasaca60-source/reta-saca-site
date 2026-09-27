// El link privado del organizador (/r/<token>): ver su reserva, quién ha
// pagado, compartir el cobro y cancelar. Es también la confirmación al pagar.
// Sin cuenta: quien tiene este link manda sobre la reserva (RESERVAS.md §6).

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { servicio } from '../../datos'
import { mensajeDeError, usarDatos } from '../../mecanismos/datos/usarDatos'
import { direccion, enlaceWhatsApp } from '../../mecanismos/whatsapp/enlaces'
import { formatoDinero } from '../../negocio/formato'
import { pagado, pendiente, puedeCancelarConDevolucion, type Reserva } from '../../negocio/reserva'
import { fechaLarga, formatoDuracion, formatoHora, instante } from '../../negocio/tiempo'
import { Fila } from '../../vista/Fila'
import { IconoPalomita } from '../../vista/Iconos'
import './mi-reserva.css'

export default function MiReserva() {
  const { token = '' } = useParams()
  const navegar = useNavigate()
  const [busqueda] = useSearchParams()
  const pago = busqueda.get('pago')
  const { datos, cargando, error } = usarDatos(
    () => Promise.all([servicio.reservaPorTokenPrivado(token), servicio.configuracion()]),
    [token],
  )
  const [accion, setAccion] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)

  if (error) return <div className="card">{error}</div>
  if (!datos && cargando) return <div className="card cargando">Cargando tu reserva…</div>
  const [r, config] = datos ?? [null, null]
  if (!r || !config) {
    return (
      <div className="card">
        <h2 className="section-title">No encontramos esa reserva</h2>
        <p className="section-hint">Revisa que el link esté completo. Si lo perdiste, recepción te lo puede reenviar.</p>
        <Link className="btn btn-primary" to="/">
          Hacer una reserva
        </Link>
      </div>
    )
  }

  const d = config.deportes[r.deporte]
  const ahora = Date.now()
  const falta = pendiente(r)
  const miParte = r.partes.find((p) => p.delOrganizador && p.concepto === 'reserva')
  const linkCobro = direccion(`/c/${r.tokenCobro}`)
  const linkPrivado = direccion(`/r/${r.tokenPrivado}`)
  const cuando = `${fechaLarga(r.fecha)} a las ${formatoHora(r.inicio)}`
  const yaEmpezo = instante(r.fecha, r.inicio) <= ahora
  const conDevolucion = puedeCancelarConDevolucion(r, config, ahora)

  const ejecutar = async (nombre: string, f: () => Promise<unknown>) => {
    setAccion(nombre)
    setErrorAccion(null)
    try {
      await f()
    } catch (e) {
      setErrorAccion(mensajeDeError(e))
    } finally {
      setAccion(null)
    }
  }

  const pagarMiParte = () =>
    ejecutar('pagar', async () => {
      const { url } = await servicio.iniciarPago(r.tokenPrivado, [miParte!.id], r.organizador.nombre)
      if (url.startsWith('/')) navegar(url)
      else window.location.assign(url)
    })

  const cancelar = () => ejecutar('cancelar', () => servicio.cancelarComoCliente(r.tokenPrivado).then(() => setConfirmandoCancelar(false)))

  return (
    <div className="screen">
      {pago === 'aprobado' && r.estado === 'confirmada' && (
        <div className="card success-wrap">
          <div className="success-icon">
            <IconoPalomita tamano={28} grosor={2.4} />
          </div>
          <div className="success-title">¡Reserva lista!</div>
          <p className="section-hint">Guarda este link: aquí ves quién ha pagado, compartes el cobro y puedes cancelar.</p>
        </div>
      )}
      {pago === 'cancelado' && r.estado === 'apartada' && (
        <p className="aviso-alerta" role="alert">
          No se hizo el pago. Tu mesa sigue apartada unos minutos: puedes intentarlo otra vez.
        </p>
      )}

      <div className="card">
        <div className="encabezado-reserva">
          <h2 className="section-title">
            {d.nombre} · {formatoHora(r.inicio)}
          </h2>
          <EstadoReserva r={r} />
        </div>
        <p className="section-hint">{cuando}</p>
        <div className="code-box">{r.folio}</div>
        <Fila etiqueta="Duración" valor={formatoDuracion(r.duracion)} />
        <Fila etiqueta="A nombre de" valor={r.organizador.nombre} />
        {r.conPromo && <Fila etiqueta="Promo aplicada" valor="Sí" color="var(--teal)" />}
        <div className="summary-total">
          <span className="label">Total por la mesa</span>
          <span className="value">{formatoDinero(r.partes.reduce((s, p) => s + p.monto, 0))}</span>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Pagos</h2>
        <ListaDePartes r={r} />
        <p className="section-hint" style={{ marginTop: 12, marginBottom: 0 }}>
          Pagado {formatoDinero(pagado(r))}
          {falta > 0 && r.estado !== 'cancelada' && <> · faltan {formatoDinero(falta)}: se pagan con el link o en el local; si no, los cubres tú.</>}
        </p>
      </div>

      {errorAccion && (
        <p className="error-text" role="alert">
          {errorAccion}
        </p>
      )}

      {r.estado === 'apartada' && miParte && !miParte.pago && (
        <button type="button" className="btn btn-primary" disabled={accion !== null} onClick={pagarMiParte}>
          Pagar mi parte ({formatoDinero(miParte.monto)})
        </button>
      )}

      {r.estado === 'confirmada' && (
        <div className="acciones">
          {r.partesElegidas > 1 && falta > 0 && (
            <a
              className="btn btn-primary"
              href={enlaceWhatsApp(`Ya aparté la mesa de ${d.nombre} para el ${cuando} (Reta Saca). Aquí pagas tu parte: ${linkCobro}`)}
              target="_blank"
              rel="noreferrer"
            >
              Mandar link de cobro a mis amigos
            </a>
          )}
          <a
            className="btn btn-ghost"
            href={enlaceWhatsApp(`Mi reserva en Reta Saca (${r.folio}), ${cuando}: ${linkPrivado}`, r.organizador.whatsapp)}
            target="_blank"
            rel="noreferrer"
          >
            Enviarme este link por WhatsApp
          </a>
          {config.whatsappNegocio && (
            <a
              className="btn btn-ghost"
              href={enlaceWhatsApp(`Hola, reservé ${d.nombre} para el ${cuando}. Folio ${r.folio}, a nombre de ${r.organizador.nombre}.`, config.whatsappNegocio)}
              target="_blank"
              rel="noreferrer"
            >
              Avisar al negocio
            </a>
          )}
        </div>
      )}

      {r.estado !== 'cancelada' && !yaEmpezo && (
        <div className="card zona-cancelar">
          {!confirmandoCancelar ? (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmandoCancelar(true)}>
              Cancelar reserva
            </button>
          ) : (
            <>
              <p className="section-hint">
                {conDevolucion
                  ? `Se devuelve todo lo pagado en línea a cada persona que pagó.`
                  : `Faltan menos de ${config.reglas.horasParaCancelar} horas: si cancelas NO hay devolución. La mesa se libera para alguien más.`}
              </p>
              <div className="nav-row" style={{ marginTop: 0 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmandoCancelar(false)}>
                  No, mantener
                </button>
                <button type="button" className="btn btn-primary" disabled={accion !== null} onClick={cancelar}>
                  {conDevolucion ? 'Sí, cancelar' : 'Cancelar sin devolución'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <Link className="enlace-discreto" to="/">
        Hacer otra reserva
      </Link>
    </div>
  )
}

export function EstadoReserva({ r }: { r: Reserva }) {
  if (r.estado === 'apartada') {
    return <span className="estado estado-apartada">Apartada hasta {r.apartadaHasta ? new Date(r.apartadaHasta).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Hermosillo' }) : ''}</span>
  }
  if (r.estado === 'cancelada') {
    const motivo = { cliente: 'Cancelada', negocio: 'Cancelada por el negocio', no_llego: 'Liberada (no llegaron)', apartado_vencido: 'No se pagó a tiempo' }
    return <span className="estado estado-cancelada">{r.cancelacion ? motivo[r.cancelacion.motivo] : 'Cancelada'}</span>
  }
  return <span className="estado estado-confirmada">Confirmada</span>
}

export function ListaDePartes({ r }: { r: Pick<Reserva, 'partes' | 'organizador'> }) {
  let amigo = 0
  return (
    <div>
      {r.partes.map((p) => {
        const quien =
          p.concepto === 'extension' ? 'Tiempo extra' : p.concepto === 'cambio' ? 'Diferencia por cambio' : p.delOrganizador ? `${r.organizador.nombre} (organiza)` : `Parte ${++amigo + 1}`
        const estado = !p.pago ? 'Pendiente' : p.pago.devuelto ? 'Devuelto' : `Pagó ${p.pago.nombre}`
        return (
          <div key={p.id} className={'summary-row parte' + (p.pago && !p.pago.devuelto ? ' pagada' : '')}>
            <span className="label">{quien}</span>
            <span className="value">
              {formatoDinero(p.monto)} · {estado}
            </span>
          </div>
        )
      })}
    </div>
  )
}
