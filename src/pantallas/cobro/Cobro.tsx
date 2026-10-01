// El link de cobro (/c/<token>) que el organizador manda a sus amigos. Lo
// puede abrir cualquiera: por eso no enseña el WhatsApp del organizador ni
// deja cancelar. Pide solo el nombre de quien paga (RESERVAS.md §6).

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { servicio } from '../../datos'
import { mensajeDeError, usarDatos } from '../../mecanismos/datos/usarDatos'
import { formatoDinero } from '../../negocio/formato'
import { nombreDelDia } from '../../negocio/tiempo'
import { Pase } from '../../vista/Pase'
import { pagoDeMercadoPago, registrarAlVolver } from '../../mecanismos/pagos/alVolver'

export default function Cobro() {
  const { token = '' } = useParams()
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const pagoId = pagoDeMercadoPago(busqueda)
  const { datos, cargando, error } = usarDatos(async () => {
    await registrarAlVolver(pagoId)
    return Promise.all([servicio.vistaDeCobro(token), servicio.configuracion()])
  }, [token, pagoId])
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorPago, setErrorPago] = useState<string | null>(null)

  if (error) return <p className="aviso aviso-error">{error}</p>
  if (!datos && cargando) return <p className="cargando">Cargando…</p>
  const [v, config] = datos ?? [null, null]
  if (!v || !config) {
    return (
      <>
        <h1 className="titulo-grande" style={{ marginTop: 24 }}>
          Este link de cobro no existe
        </h1>
        <p className="nota">Pídele a quien reservó que te lo mande otra vez.</p>
      </>
    )
  }

  const d = config.deportes[v.deporte]
  const pendientes = v.partes.filter((p) => !p.pagada)
  const falta = pendientes.reduce((s, p) => s + p.monto, 0)
  // "Mi parte" = la primera pendiente que no sea la del organizador (si queda alguna).
  const miParte = pendientes.find((p) => !p.delOrganizador) ?? pendientes[0]
  const nombreValido = nombre.trim().length > 1
  const recienPagado = busqueda.get('pago') === 'aprobado'

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

  let amigo = 1
  return (
    <>
      <h1 className="titulo-grande" style={{ marginTop: 20 }}>
        {recienPagado
  ? v.deporte === 'cornhole'
    ? '¡Pagado! Nos vemos en el tablero'
    : '¡Pagado! Nos vemos en la mesa'
  : `${v.organizador} te invitó a jugar`}
      </h1>

      <div style={{ marginTop: 18 }}>
        <Pase
          config={config}
          datos={{
            deporteId: v.deporte,
            deporte: d.nombre,
            dia: nombreDelDia(v.fecha),
            inicio: v.inicio,
            duracion: v.duracion,
            titular: v.organizador,
            total: v.partes.reduce((s, p) => s + p.monto, 0),
            folio: v.folio,
            estado: v.estado === 'cancelada' ? 'Cancelada' : pendientes.length ? `Faltan ${formatoDinero(falta)}` : 'Todo pagado',
            apagado: v.estado === 'cancelada',
          }}
        />
      </div>

      <h2 className="titulo-seccion">Quién ya pagó</h2>
      <ul className="grupo">
        {v.partes.map((p) => (
          <li key={p.id} className="fila-pago">
            <span className="fila-pago-texto">
              <strong>{p.delOrganizador ? `${v.organizador} (organiza)` : `Amigo ${amigo++}`}</strong>
              <span className={p.pagada ? 'pagada' : ''}>{p.pagada ? `Pagó ${p.nombre}` : 'Pendiente'}</span>
            </span>
            <span className="numeros">{formatoDinero(p.monto)}</span>
          </li>
        ))}
      </ul>

      {v.estado === 'cancelada' && <p className="aviso aviso-alerta">Esta reserva se canceló. No hay nada que pagar.</p>}
      {v.estado !== 'cancelada' && pendientes.length === 0 && <p className="nota">Ya está todo pagado.</p>}

      {v.estado !== 'cancelada' && pendientes.length > 0 && (
        <>
          <h2 className="titulo-seccion">Paga tu parte</h2>
          <div className="grupo">
            <div className="campo-form">
              <label htmlFor="cobro-nombre">Nombre</label>
              <input id="cobro-nombre" type="text" placeholder="Para que sepan quién pagó" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
          </div>
          <p className="nota-chica">También puedes pagar en el local, en efectivo o con tarjeta.</p>
          {errorPago && (
            <p className="aviso aviso-error" role="alert">
              {errorPago}
            </p>
          )}
          {pendientes.length > 1 && (
            <div className="acciones">
              <button type="button" className="boton boton-secundario" disabled={!nombreValido || enviando} onClick={() => pagar(pendientes.map((p) => p.id))}>
                Pagar todo lo que falta ({formatoDinero(falta)})
              </button>
            </div>
          )}
          <div className="barra-accion">
            <button type="button" className="boton boton-principal" disabled={!nombreValido || enviando} onClick={() => pagar([miParte.id])}>
              Pagar mi parte ({formatoDinero(miParte.monto)})
            </button>
          </div>
        </>
      )}

      <Link className="enlace-discreto" to="/">
        Hacer otra reserva
      </Link>
    </>
  )
}
