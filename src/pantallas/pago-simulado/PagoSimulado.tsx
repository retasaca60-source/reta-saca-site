// La pantalla de pago de MENTIRA que ocupa el lugar de Mercado Pago mientras
// no hay cuenta del negocio. Con la versión real, el cliente va a Mercado Pago
// y esta página no existe (ver CONTRATO-DE-DATOS.md → Pagos).

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { servicioSimulado } from '../../datos'
import { mensajeDeError, usarDatos } from '../../mecanismos/datos/usarDatos'
import { formatoDinero } from '../../negocio/formato'
import { etiquetaFecha, formatoHora } from '../../negocio/tiempo'

export default function PagoSimulado() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { datos, cargando } = usarDatos(async () => (servicioSimulado ? servicioSimulado.pagoSimulado.obtener(id) : null), [id])

  const demo = servicioSimulado
  if (!demo) return <div className="card">Esta página solo existe en la demostración.</div>
  if (cargando && !datos) return <div className="card cargando">Cargando…</div>
  if (!datos) return <div className="card">Ese pago no existe.</div>

  const { intento, reserva } = datos
  const pagar = async (aprobar: boolean) => {
    setEnviando(true)
    setError(null)
    try {
      const volver = aprobar ? await demo.pagoSimulado.confirmar(id) : await demo.pagoSimulado.rechazar(id)
      navegar(volver)
    } catch (e) {
      setError(mensajeDeError(e))
      setEnviando(false)
    }
  }

  return (
    <div className="screen">
      <div className="card pago-simulado">
        <div className="pago-simulado-marca">Mercado Pago · SIMULADO</div>
        <p className="section-hint">Esta pantalla ocupa el lugar de Mercado Pago mientras no hay cuenta del negocio. No se cobra nada.</p>
        <div className="summary-row">
          <span className="label">Concepto</span>
          <span className="value">Reta Saca · {reserva.folio}</span>
        </div>
        <div className="summary-row">
          <span className="label">Reserva</span>
          <span className="value">
            {etiquetaFecha(reserva.fecha)} · {formatoHora(reserva.inicio)}
          </span>
        </div>
        <div className="summary-row">
          <span className="label">Paga</span>
          <span className="value">{intento.nombre}</span>
        </div>
        <div className="summary-total">
          <span className="label">Total</span>
          <span className="value">{formatoDinero(intento.monto)}</span>
        </div>
        {intento.resultado && <p className="section-hint">Este pago ya se {intento.resultado === 'pagado' ? 'hizo' : 'canceló'}.</p>}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" disabled={enviando || Boolean(intento.resultado)} onClick={() => pagar(false)}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" disabled={enviando || Boolean(intento.resultado)} onClick={() => pagar(true)}>
          {enviando ? 'Pagando…' : `Pagar ${formatoDinero(intento.monto)}`}
        </button>
      </div>
    </div>
  )
}
