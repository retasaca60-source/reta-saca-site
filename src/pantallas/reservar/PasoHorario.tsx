// Paso 2: día, duración y hora de inicio, con la disponibilidad del servicio.

import { useEffect, type Dispatch } from 'react'
import { servicio } from '../../datos'
import { usarDatos } from '../../mecanismos/datos/usarDatos'
import type { Accion, Borrador } from '../../mecanismos/reserva/estado'
import type { Configuracion } from '../../negocio/configuracion'
import { avisoPocosLugares } from '../../negocio/disponibilidad'
import { formatoDinero } from '../../negocio/formato'
import { diasReservables } from '../../negocio/horario'
import { ahoraEnSonora, DIAS_CORTOS, diaDeLaSemana, formatoHora, horaDe24 } from '../../negocio/tiempo'
import './horario.css'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

export function PasoHorario({ borrador, despachar, config }: Props) {
  const { fecha, duracion, inicio, partes } = borrador
  // Este paso solo se abre con deporte y forma de pago elegidos (PasoDeporte no deja seguir sin ellos).
  const deporte = borrador.deporte!
  const d = config.deportes[deporte]
  const dias = diasReservables(config, ahoraEnSonora())
  const { datos: horarios, cargando, error } = usarDatos(() => servicio.disponibilidad(deporte, fecha, duracion), [deporte, fecha, duracion])

  // Si la hora elegida ya no está libre (se llenó, o pasó el corte mientras
  // decidía), se suelta: así no se puede seguir con una hora que la pantalla
  // dice llena. Ese error ya pasó una vez (RESERVAS.md → registro).
  useEffect(() => {
    if (inicio === null || !horarios) return
    if (!horarios.some((x) => x.inicio === inicio && x.libres > 0)) despachar({ tipo: 'soltarHora' })
  }, [horarios, inicio, despachar])

  const hayPromo = horarios?.some((x) => x.conPromo)

  return (
    <div className="screen">
      <div className="card">
        <h2 className="section-title">Fecha y duración</h2>
        <p className="section-hint">
          {d.nombre} · {partes === 1 ? 'pago completo' : `pago entre ${partes}`}
        </p>

        <div className="field-label">Fecha</div>
        <div className="date-scroll">
          {dias.map((dia) => {
            const [, , num] = dia.fecha.split('-').map(Number)
            const dow = diaDeLaSemana(dia.fecha)
            return (
              <button
                key={dia.fecha}
                type="button"
                className={'date-chip' + (fecha === dia.fecha ? ' selected' : '')}
                aria-pressed={fecha === dia.fecha}
                disabled={dia.cerrado}
                title={dia.cerrado ? 'Cerrado' : undefined}
                onClick={() => despachar({ tipo: 'elegirFecha', fecha: dia.fecha })}
              >
                <div className="dow">{DIAS_CORTOS[dow]}</div>
                <div className="num">{num}</div>
                {dia.cerrado && <div className="dow">Cerrado</div>}
              </button>
            )
          })}
        </div>

        <div className="field-label">Duración</div>
        <div className="chip-row">
          {d.duraciones.map((m) => (
            <button
              key={m}
              type="button"
              className={'chip' + (duracion === m ? ' selected' : '')}
              aria-pressed={duracion === m}
              onClick={() => despachar({ tipo: 'elegirDuracion', duracion: m })}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Horario disponible</h2>
        {borrador.aviso && (
          <p className="aviso-alerta" role="alert">
            {borrador.aviso}
          </p>
        )}
        {hayPromo && <div className="promo-strip">Promo: 60 min empezando 5:00 o 5:30 PM</div>}
        {error && <p className="error-text">{error}</p>}
        {!horarios && cargando && <p className="section-hint">Buscando horarios…</p>}
        {horarios && horarios.length === 0 && (
          <p className="section-hint">No hay horarios para este día con {duracion} min. Prueba otro día o una duración más corta.</p>
        )}
        {horarios && horarios.length > 0 && (
          <div className="slot-grid" aria-busy={cargando}>
            {horarios.map((x) => {
              const lleno = x.libres < 1
              const aviso = lleno ? null : avisoPocosLugares(config, deporte, x.libres)
              const elegido = inicio === x.inicio && !lleno
              return (
                <button
                  key={x.inicio}
                  type="button"
                  className={'slot' + (lleno ? ' full' : '') + (x.conPromo && !lleno ? ' promo' : '') + (elegido ? ' selected' : '')}
                  disabled={lleno}
                  aria-pressed={elegido}
                  data-hora={horaDe24(x.inicio)}
                  onClick={() => despachar({ tipo: 'elegirHora', inicio: x.inicio })}
                >
                  <div className="t">{formatoHora(x.inicio)}</div>
                  <div className="p">{lleno ? 'Lleno' : formatoDinero(x.precio)}</div>
                  {aviso && <div className="low">{aviso}</div>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => despachar({ tipo: 'irAPaso', paso: 1, config })}>
          Atrás
        </button>
        <button type="button" className="btn btn-primary" disabled={inicio === null} onClick={() => despachar({ tipo: 'irAPaso', paso: 3, config })}>
          Continuar
        </button>
      </div>
    </div>
  )
}
