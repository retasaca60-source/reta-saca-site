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
  if (!demo) return <p className="nota">Esta página solo existe en la demostración.</p>
  if (cargando && !datos) return <p className="cargando">Cargando…</p>
  if (!datos) return <p className="nota">Ese pago no existe.</p>

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
    <>
      <h1 className="titulo-grande" style={{ marginTop: 20 }}>
        Pagar
      </h1>
      <p className="aviso aviso-alerta">Esta pantalla ocupa el lugar de Mercado Pago mientras no hay cuenta del negocio. No se cobra nada.</p>
      <div className="grupo" style={{ marginTop: 16 }}>
        <div className="fila-pago">
          <span className="fila-pago-texto">
            <strong>Reta Saca · {reserva.folio}</strong>
            <span>
              {etiquetaFecha(reserva.fecha)} · {formatoHora(reserva.inicio)} · paga {intento.nombre}
            </span>
          </span>
          <span className="numeros">{formatoDinero(intento.monto)}</span>
        </div>
      </div>
      {intento.resultado && <p className="nota">Este pago ya se {intento.resultado === 'pagado' ? 'hizo' : 'canceló'}.</p>}
      {error && (
        <p className="aviso aviso-error" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        <button type="button" className="boton boton-texto" disabled={enviando || Boolean(intento.resultado)} onClick={() => pagar(false)}>
          Cancelar el pago
        </button>
      </div>
      <div className="barra-accion">
        <button type="button" className="boton boton-principal" disabled={enviando || Boolean(intento.resultado)} onClick={() => pagar(true)}>
          {enviando ? 'Pagando…' : `Pagar ${formatoDinero(intento.monto)}`}
        </button>
      </div>
    </>
  )
}
