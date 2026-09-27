// El link de cobro (/c/<token>) que el organizador manda a sus amigos.
// Lo puede abrir cualquiera: por eso no enseña el WhatsApp del organizador ni
// deja cancelar. Pide solo el nombre de quien paga (RESERVAS.md §6).

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { servicio } from '../../datos'
import { mensajeDeError, usarDatos } from '../../mecanismos/datos/usarDatos'
import { formatoDinero } from '../../negocio/formato'
import { fechaLarga, formatoDuracion, formatoHora } from '../../negocio/tiempo'
import { Fila } from '../../vista/Fila'
import { IconoPalomita } from '../../vista/Iconos'

export default function Cobro() {
  const { token = '' } = useParams()
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const { datos, cargando, error } = usarDatos(() => Promise.all([servicio.vistaDeCobro(token), servicio.configuracion()]), [token])
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorPago, setErrorPago] = useState<string | null>(null)

  if (error) return <div className="card">{error}</div>
  if (!datos && cargando) return <div className="card cargando">Cargando…</div>
  const [v, config] = datos ?? [null, null]
  if (!v || !config) {
    return (
      <div className="card">
        <h2 className="section-title">Este link de cobro no existe</h2>
        <p className="section-hint">Pídele a quien reservó que te lo mande otra vez.</p>
      </div>
    )
  }

  const d = config.deportes[v.deporte]
  const pendientes = v.partes.filter((p) => !p.pagada)
  const falta = pendientes.reduce((s, p) => s + p.monto, 0)
  // "Mi parte" = la primera pendiente que no sea la del organizador (si queda alguna).
  const miParte = pendientes.find((p) => !p.delOrganizador) ?? pendientes[0]
  const nombreValido = nombre.trim().length > 1

  const pagar = async (ids: string[]) => {
    setEnviando(true)
    setErrorPago(null)
    try {
      const { url } = await servicio.iniciarPago(token, ids, nombre)
      if (url.startsWith('/')) navegar(url)
      else window.location.assign(url)
    } catch (e) {
      setErrorPago(mensajeDeError(e))
      setEnviando(false)
    }
  }

  return (
    <div className="screen">
      {busqueda.get('pago') === 'aprobado' && (
        <div className="card success-wrap">
          <div className="success-icon">
            <IconoPalomita tamano={28} grosor={2.4} />
          </div>
          <div className="success-title">¡Pago recibido!</div>
          <p className="section-hint">Ya quedó registrado. Nos vemos en la mesa.</p>
        </div>
      )}

      <div className="card">
        <p className="section-hint" style={{ marginBottom: 4 }}>
          {v.organizador} te invitó a jugar
        </p>
        <h2 className="section-title">
          {d.nombre} · {formatoHora(v.inicio)}
        </h2>
        <p className="section-hint">
          {fechaLarga(v.fecha)} · {formatoDuracion(v.duracion)} · folio {v.folio}
        </p>
        {v.partes.map((p, i) => (
          <Fila
            key={p.id}
            etiqueta={p.delOrganizador ? `${v.organizador} (organiza)` : `Parte ${i + 1}`}
            valor={`${formatoDinero(p.monto)} · ${p.pagada ? `Pagó ${p.nombre}` : 'Pendiente'}`}
          />
        ))}
      </div>

      {v.estado === 'cancelada' && <p className="aviso-alerta">Esta reserva se canceló. No hay nada que pagar.</p>}

      {v.estado !== 'cancelada' && pendientes.length === 0 && (
        <div className="card">
          <p className="section-hint" style={{ margin: 0 }}>
            Ya está todo pagado.
          </p>
        </div>
      )}

      {v.estado !== 'cancelada' && pendientes.length > 0 && (
        <div className="card">
          <h2 className="section-title">Pagar</h2>
          <p className="section-hint">También puedes pagar en el local, en efectivo, tarjeta o transferencia.</p>
          <label className="field-label" htmlFor="cobro-nombre">
            Tu nombre
          </label>
          <input id="cobro-nombre" type="text" placeholder="Para que sepan quién pagó" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {errorPago && (
            <p className="error-text" role="alert">
              {errorPago}
            </p>
          )}
          <div className="acciones" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" disabled={!nombreValido || enviando} onClick={() => pagar([miParte.id])}>
              Pagar mi parte ({formatoDinero(miParte.monto)})
            </button>
            {pendientes.length > 1 && (
              <button type="button" className="btn btn-ghost" disabled={!nombreValido || enviando} onClick={() => pagar(pendientes.map((p) => p.id))}>
                Pagar lo que falta ({formatoDinero(falta)})
              </button>
            )}
          </div>
        </div>
      )}

      <Link className="enlace-discreto" to="/">
        Reservar otra mesa
      </Link>
    </div>
  )
}
