// Las cancelaciones con pagos en línea que el negocio no ha resuelto. El
// sistema no devuelve dinero: el negocio decide caso por caso y, si devuelve,
// transfiere desde su banco a la CLABE que el cliente le manda por WhatsApp.
// Vive en Caja porque es dinero, y sale de todas las fechas: una devolución de
// hace dos semanas no puede perderse porque ya nadie abre ese día.

import { useState } from 'react'
import { servicio } from '../datos'
import { mensajeDeError, usarDatos } from '../mecanismos/datos/usarDatos'
import { enlaceWhatsApp } from '../mecanismos/whatsapp/enlaces'
import { formatoDinero, whatsappLegible } from '../negocio/formato'
import type { Reserva } from '../negocio/reserva'
import { etiquetaFecha, formatoHora } from '../negocio/tiempo'

export function Devoluciones() {
  const { datos: reservas, error, recargar } = usarDatos(() => servicio.devolucionesPorRevisar(), [])
  if (error) return <p className="panel-error">{error}</p>
  if (!reservas?.length) return null
  return (
    <section className="panel-seccion">
      <h2>
        Devoluciones por revisar <small>· {reservas.length}</small>
      </h2>
      {reservas.map((r) => (
        <Devolucion key={r.id} r={r} alResolver={recargar} />
      ))}
    </section>
  )
}

function Devolucion({ r, alResolver }: { r: Reserva; alResolver: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pagos = r.partes.filter((p) => p.pago?.medio === 'en_linea' && !p.pago.devuelto)
  const monto = formatoDinero(r.devolucion!.monto)
  const quien = r.cancelacion?.motivo === 'negocio' ? `la canceló ${r.cancelacion.por ?? 'el negocio'}` : 'la canceló el cliente'

  const resolver = async (decision: 'transferida' | 'sin_devolucion') => {
    const pregunta =
      decision === 'transferida'
        ? `¿Ya se transfirieron ${monto} a ${r.organizador.nombre}? Deja de contar como cobrado en la caja.`
        : `¿No se le devuelve nada a ${r.organizador.nombre}? El cliente lo verá en su reserva.`
    if (!confirm(pregunta)) return
    setOcupado(true)
    setError(null)
    try {
      await servicio.resolverDevolucion(r.id, decision)
      alResolver()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <article className="fila-reserva devolucion">
      {/* Vertical y no en la cuadrícula de las filas: con folio, quién canceló y
          quiénes pagaron, la columna de en medio quedaba de una palabra por renglón. */}
      <div className="devolucion-cabeza">
        <strong>{r.organizador.nombre}</strong>
        <strong className="numeros">{monto}</strong>
      </div>
      <small>
        {r.folio} · {etiquetaFecha(r.fecha)}, {formatoHora(r.inicio)} · {quien}
      </small>
      {r.organizador.whatsapp && <small>WhatsApp {whatsappLegible(r.organizador.whatsapp)}</small>}
      <small>Pagaron en línea: {pagos.map((p) => `${p.pago!.nombre} ${formatoDinero(p.monto)}`).join(', ')}</small>
      <div className="fila-acciones">
        <button type="button" className="panel-boton primario" disabled={ocupado} onClick={() => resolver('transferida')}>
          Ya se transfirió
        </button>
        <button type="button" className="panel-boton" disabled={ocupado} onClick={() => resolver('sin_devolucion')}>
          Sin devolución
        </button>
        {r.organizador.whatsapp && (
          <a
            className="panel-boton"
            href={enlaceWhatsApp(`Hola ${r.organizador.nombre}, sobre tu reserva cancelada en Reta Saca (${r.folio}): `, r.organizador.whatsapp)}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        )}
      </div>
      {error && <p className="panel-error">{error}</p>}
    </article>
  )
}
