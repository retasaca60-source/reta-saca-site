// Semana: hoy y los días que se pueden reservar, como calendario. Arriba una
// tira con cada día (cuántas reservas y cuánto suma); al tocar uno, su resumen
// y su lista por hora, la misma de "Reservas del día". Antes eran los ocho días
// uno tras otro con todos los botones a la vista: para ver el sábado había que
// bajar por toda la semana.

import { useSearchParams } from 'react-router-dom'
import { servicio } from '../datos'
import { usarDatos } from '../mecanismos/datos/usarDatos'
import { ORDEN_DEPORTES } from '../negocio/configuracion'
import { formatoDinero } from '../negocio/formato'
import { pendiente, total } from '../negocio/reserva'
import { DIAS_CORTOS, ahoraEnSonora, diaDeLaSemana, fechaLarga, sumarDias } from '../negocio/tiempo'
import { ListaDelDia } from './ListaDelDia'

export function Semana() {
  const hoy = ahoraEnSonora().fecha
  const [busqueda, setBusqueda] = useSearchParams()
  const { datos, error } = usarDatos(async () => {
    const config = await servicio.configuracion()
    const hasta = sumarDias(hoy, config.reglas.diasDeAnticipacion)
    return [config, await servicio.reservasEntre(hoy, hasta), hasta] as const
  }, [hoy])

  if (error) return <p className="panel-error">{error}</p>
  if (!datos) return <p className="nota">Cargando…</p>
  const [config, reservas, hasta] = datos
  const dias: string[] = []
  for (let f = hoy; f <= hasta; f = sumarDias(f, 1)) dias.push(f)
  // El día elegido viaja en la dirección (?dia=…): así la gráfica de "Hoy"
  // puede mandar directo a un día y recargar no lo pierde.
  const pedido = busqueda.get('dia')
  const elegido = pedido && dias.includes(pedido) ? pedido : hoy

  const resumen = (f: string) => {
    const delDia = reservas.filter((r) => r.fecha === f && r.estado !== 'cancelada')
    return {
      delDia,
      cuenta: delDia.length,
      suma: delDia.reduce((s, r) => s + total(r), 0),
      falta: delDia.reduce((s, r) => s + pendiente(r), 0),
    }
  }
  const mas = Math.max(1, ...dias.map((f) => resumen(f).cuenta))
  const dia = resumen(elegido)

  return (
    <div className="semana">
      <header className="hoy-cabeza">
        <div>
          <h1>Semana</h1>
          <p>Hoy y los próximos {config.reglas.diasDeAnticipacion} días, que es lo que se puede reservar.</p>
        </div>
      </header>

      <div className="semana-tira" role="group" aria-label="Elegir día">
        {dias.map((f) => {
          const r = resumen(f)
          return (
            <button
              key={f}
              type="button"
              className={'semana-dia' + (r.cuenta === 0 ? ' vacio' : '')}
              aria-pressed={f === elegido}
              onClick={() => setBusqueda(f === hoy ? {} : { dia: f })}
            >
              <span className="semana-dia-nombre">{f === hoy ? 'Hoy' : DIAS_CORTOS[diaDeLaSemana(f)]}</span>
              <span className="semana-dia-numero">{Number(f.slice(8))}</span>
              <span className="semana-dia-carga" aria-hidden>
                <span style={{ width: `${(r.cuenta / mas) * 100}%` }} />
              </span>
              <span className="semana-dia-cuenta">
                {r.cuenta === 0 ? 'Sin reservas' : `${r.cuenta} ${r.cuenta === 1 ? 'reserva' : 'reservas'}`}
              </span>
              {r.cuenta > 0 && <span className="semana-dia-suma">{formatoDinero(r.suma)}</span>}
            </button>
          )
        })}
      </div>

      <section className="semana-resumen">
        <h2>{fechaLarga(elegido)}</h2>
        <dl>
          <div>
            <dt>Reservas</dt>
            <dd>{dia.cuenta}</dd>
          </div>
          <div>
            <dt>Total del día</dt>
            <dd>{formatoDinero(dia.suma)}</dd>
          </div>
          <div>
            <dt>Falta cobrar</dt>
            <dd className={dia.falta > 0 ? 'falta' : ''}>{formatoDinero(dia.falta)}</dd>
          </div>
          {ORDEN_DEPORTES.map((id) => (
            <div key={id}>
              <dt>{config.deportes[id].nombre}</dt>
              <dd>{dia.delDia.filter((r) => r.deporte === id).length}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ListaDelDia
        key={elegido}
        reservas={reservas.filter((r) => r.fecha === elegido)}
        config={config}
      />
    </div>
  )
}
