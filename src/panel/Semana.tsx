// Semana: las reservas de hoy a 7 días, agrupadas por día.

import { servicio } from '../datos'
import { usarDatos } from '../mecanismos/datos/usarDatos'
import { ahoraEnSonora, fechaLarga, sumarDias } from '../negocio/tiempo'
import { FilaReserva } from './FilaReserva'

export function Semana() {
  const hoy = ahoraEnSonora().fecha
  const { datos, error } = usarDatos(async () => {
    const config = await servicio.configuracion()
    const hasta = sumarDias(hoy, config.reglas.diasDeAnticipacion)
    return [config, await servicio.reservasEntre(hoy, hasta), hasta] as const
  }, [hoy])

  if (error) return <p className="panel-error">{error}</p>
  if (!datos) return <p>Cargando…</p>
  const [config, reservas, hasta] = datos
  const dias: string[] = []
  for (let f = hoy; f <= hasta; f = sumarDias(f, 1)) dias.push(f)

  return (
    <div>
      <div className="panel-titulo">
        <h1>Próximos {config.reglas.diasDeAnticipacion} días</h1>
      </div>
      {dias.map((f) => {
        const delDia = reservas.filter((r) => r.fecha === f && r.estado !== 'cancelada')
        return (
          <section key={f} className="panel-seccion">
            <h2>
              {fechaLarga(f)} · {delDia.length}
            </h2>
            {delDia.length === 0 ? <p className="nota">Sin reservas.</p> : delDia.map((r) => <FilaReserva key={r.id} r={r} config={config} />)}
          </section>
        )
      })}
    </div>
  )
}
