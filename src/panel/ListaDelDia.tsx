// "Reservas del día" ordenadas como se viven en el mostrador: por hora, y en
// cada fila de un vistazo quién reservó en línea y quién llegó sin reserva, y
// si ya llegaron, si están por llegar o si van tarde. Los botones (sentar,
// cobrar, extender…) salen al tocar la fila: antes iban en todas y la lista se
// volvía una pared de botones donde costaba encontrar a alguien.

import { useState } from 'react'
import type { Configuracion } from '../negocio/configuracion'
import { formatoDinero } from '../negocio/formato'
import { fin, pagado, pendiente, puedeLiberarPorRetraso, total, type Reserva } from '../negocio/reserva'
import { ahoraEnSonora, formatoDuracion, formatoHora } from '../negocio/tiempo'
import { FilaReserva } from './FilaReserva'

type Filtro = 'todas' | 'sitio' | 'mostrador'

export function ListaDelDia({ reservas, config, esHoy }: { reservas: Reserva[]; config: Configuracion; esHoy: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [abierta, setAbierta] = useState<string | null>(null)

  const vigentes = reservas.filter((r) => r.estado !== 'cancelada')
  const canceladas = reservas.filter((r) => r.estado === 'cancelada')
  const enLinea = vigentes.filter((r) => r.origen === 'sitio')
  const sinReserva = vigentes.filter((r) => r.origen === 'mostrador')
  const visibles = filtro === 'sitio' ? enLinea : filtro === 'mostrador' ? sinReserva : vigentes

  // Una hora por grupo: todo lo que empieza entre las 5:00 y las 5:59 va junto.
  const porHora = new Map<number, Reserva[]>()
  for (const r of [...visibles].sort((a, b) => a.inicio - b.inicio || a.organizador.nombre.localeCompare(b.organizador.nombre))) {
    const hora = Math.floor(r.inicio / 60)
    porHora.set(hora, [...(porHora.get(hora) ?? []), r])
  }

  return (
    <section className="dia">
      <div className="dia-filtros" role="group" aria-label="Quién">
        <button type="button" className="pastilla" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas <span className="pastilla-cuenta">{vigentes.length}</span>
        </button>
        <button type="button" className="pastilla" aria-pressed={filtro === 'sitio'} onClick={() => setFiltro('sitio')}>
          Reservaron en línea <span className="pastilla-cuenta">{enLinea.length}</span>
        </button>
        <button type="button" className="pastilla" aria-pressed={filtro === 'mostrador'} onClick={() => setFiltro('mostrador')}>
          Llegaron sin reserva <span className="pastilla-cuenta">{sinReserva.length}</span>
        </button>
      </div>

      {visibles.length === 0 && (
        <p className="nota">
          {filtro === 'mostrador' ? 'Nadie ha llegado sin reserva este día.' : filtro === 'sitio' ? 'No hay reservas en línea este día.' : 'No hay reservas este día.'}
        </p>
      )}

      <ol className="dia-horas">
        {[...porHora].map(([hora, lista]) => (
          <li key={hora} className="dia-hora">
            <div className="dia-hora-marca">
              <strong>{formatoHora(hora * 60)}</strong>
              <small>
                {lista.length} {lista.length === 1 ? 'grupo' : 'grupos'}
              </small>
            </div>
            <div className="dia-hora-filas">
              {lista.map((r) => (
                <Fila
                  key={r.id}
                  r={r}
                  config={config}
                  esHoy={esHoy}
                  abierta={abierta === r.id}
                  alternar={() => setAbierta(abierta === r.id ? null : r.id)}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>

      {canceladas.length > 0 && (
        <details className="panel-canceladas">
          <summary>Canceladas · {canceladas.length}</summary>
          {canceladas.map((r) => (
            <FilaReserva key={r.id} r={r} config={config} />
          ))}
        </details>
      )}
    </section>
  )
}

/** Si ya llegaron, si vienen, si van tarde: lo que recepción necesita saber de cada grupo. */
function llegada(r: Reserva, config: Configuracion, esHoy: boolean): { tono: string; texto: string } {
  if (r.estado === 'apartada') return { tono: 'aviso', texto: 'Pagando en línea…' }
  if (r.mesa) return { tono: 'bien', texto: `Llegó · en ${r.mesa}` }
  if (r.llegaronEn) return { tono: 'bien', texto: 'Llegó · falta mesa' }
  const ahora = ahoraEnSonora()
  // Si su horario ya terminó, ya no "va tarde": no vino.
  if (esHoy && fin(r) <= ahora.minutos) return { tono: 'mal', texto: 'No llegó' }
  if (esHoy && puedeLiberarPorRetraso(r, config, ahora.ms)) return { tono: 'mal', texto: 'Va tarde' }
  if (esHoy && r.inicio <= ahora.minutos && fin(r) > ahora.minutos) return { tono: 'aviso', texto: 'Ya es su hora' }
  return { tono: 'neutra', texto: 'Por llegar' }
}

function Fila({
  r,
  config,
  esHoy,
  abierta,
  alternar,
}: {
  r: Reserva
  config: Configuracion
  esHoy: boolean
  abierta: boolean
  alternar: () => void
}) {
  const d = config.deportes[r.deporte]
  const l = llegada(r, config, esHoy)
  const falta = pendiente(r)
  return (
    <article className={'dia-fila' + (abierta ? ' abierta' : '')}>
      <button type="button" className="dia-fila-resumen" aria-expanded={abierta} onClick={alternar}>
        <span className="dia-quien">
          <strong>{r.organizador.nombre}</strong>
          <small>
            {d.nombre} · {formatoHora(r.inicio)} – {formatoHora(fin(r))} · {formatoDuracion(r.duracion)}
          </small>
        </span>
        <span className="dia-etiquetas">
          <span className={'etiqueta ' + (r.origen === 'sitio' ? 'en-linea' : 'local')}>{r.origen === 'sitio' ? 'Reservó en línea' : 'Sin reserva'}</span>
          <span className={'etiqueta ' + l.tono}>{l.texto}</span>
        </span>
        <span className="dia-dinero">
          <strong>{formatoDinero(total(r))}</strong>
          <small className={falta > 0 ? 'falta' : 'bien'}>{falta > 0 ? `faltan ${formatoDinero(falta)}` : `pagado ${formatoDinero(pagado(r))}`}</small>
        </span>
        <span className="dia-flecha" aria-hidden>
          ›
        </span>
      </button>
      {abierta && (
        <div className="dia-fila-acciones">
          <p className="nota">
            {r.folio}
            {r.partesElegidas > 1 && ` · pagan entre ${r.partesElegidas}`}
            {r.conPromo && ' · promo'}
          </p>
          <FilaReserva r={r} config={config} soloAcciones />
        </div>
      )}
    </article>
  )
}
