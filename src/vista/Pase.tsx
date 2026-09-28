// El pase de la reserva, al estilo de un pase de Wallet. Mientras el cliente
// elige, los campos se van llenando; al pagar queda completo con su folio. Es
// también el resumen: no hay otra tarjeta que repita los mismos datos.
//
// Cada valor lleva `key={valor}`: al cambiar, el campo se vuelve a montar y
// entra con su transición (pase.css). Ese es el único movimiento del sitio.

import { formatoDinero } from '../negocio/formato'
import './pase.css'

export interface DatosDelPase {
  deporte?: string
  dia?: string
  hora?: string
  duracion?: string
  pagan?: string
  total?: number
  /** Lo que paga quien reserva ahora. */
  tuParte?: number
  titular?: string
  folio?: string
  /** Texto de estado en la cabeza del pase ("Confirmada", "Apartada"…). */
  estado?: string
  /** Pase apagado (cancelado). */
  apagado?: boolean
}

export function Pase({ datos }: { datos: DatosDelPase }) {
  const d = datos
  return (
    <section className={'pase' + (d.apagado ? ' apagado' : '')} aria-label="Tu pase">
      <header className="pase-cabeza">
        <img src="/imagenes/logo.png" alt="" />
        <span className="pase-marca">Reta Saca</span>
        <span className="pase-estado">{d.estado ?? d.folio ?? 'Pase'}</span>
      </header>

      <div className="pase-principal">
        <Campo etiqueta="Deporte" valor={d.deporte} />
        <Campo etiqueta="Hora" valor={d.hora} derecha />
      </div>

      <div className="pase-secundario">
        <Campo etiqueta="Día" valor={d.dia} />
        <Campo etiqueta="Tiempo" valor={d.duracion} />
        <Campo etiqueta={d.titular ? 'A nombre de' : 'Pagan'} valor={d.titular ?? d.pagan} derecha />
      </div>

      <div className="pase-corte" aria-hidden="true" />

      <footer className="pase-pie">
        <Campo etiqueta="Total por la mesa" valor={d.total !== undefined ? formatoDinero(d.total) : undefined} />
        <Campo
          etiqueta={d.folio ? 'Folio' : 'Pagas tú'}
          valor={d.folio ?? (d.tuParte !== undefined ? formatoDinero(d.tuParte) : undefined)}
          derecha
          fuerte
        />
      </footer>
    </section>
  )
}

function Campo({ etiqueta, valor, derecha, fuerte }: { etiqueta: string; valor?: string; derecha?: boolean; fuerte?: boolean }) {
  return (
    <div className={'pase-campo' + (derecha ? ' derecha' : '') + (fuerte ? ' fuerte' : '')}>
      <span className="pase-etiqueta">{etiqueta}</span>
      <span key={valor ?? 'vacio'} className={'pase-valor' + (valor ? '' : ' vacio')}>
        {valor ?? '—'}
      </span>
    </div>
  )
}
