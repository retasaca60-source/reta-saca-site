// Paso 2: día, duración y hora de inicio.

import type { Dispatch } from 'react'
import { DEPORTES, DIAS_VISIBLES } from '../../negocio/catalogo'
import { avisoPocosLugares, horasQueCaben, mesasOcupadas } from '../../negocio/disponibilidad'
import { DIAS_CORTOS, esDomingo, fechaEn, formatoDinero, formatoHora } from '../../negocio/formato'
import { esHorarioPromo, hayPromoParaDuracion, precioPara } from '../../negocio/precios'
import type { Accion, Reserva } from '../../mecanismos/reserva/estado'
import './horario.css'

interface Props {
  reserva: Reserva
  despachar: Dispatch<Accion>
}

export function PasoHorario({ reserva, despachar }: Props) {
  const { dia, duracion, hora } = reserva
  // Este paso solo se abre con deporte y personas elegidos (PasoDeporte no deja seguir sin ellos).
  const deporte = reserva.deporte!
  const personas = reserva.personas!
  const d = DEPORTES[deporte]
  const domingo = esDomingo(dia)

  return (
    <div className="screen">
      <div className="card">
        <h2 className="section-title">Fecha y duración</h2>
        <p className="section-hint">
          {d.nombre} · {personas} personas
        </p>

        <div className="field-label">Fecha</div>
        <div className="date-scroll">
          {Array.from({ length: DIAS_VISIBLES }, (_, i) => {
            const fecha = fechaEn(i)
            return (
              <button
                key={i}
                type="button"
                className={'date-chip' + (dia === i ? ' selected' : '')}
                aria-pressed={dia === i}
                onClick={() => despachar({ tipo: 'elegirDia', dia: i })}
              >
                <div className="dow">{DIAS_CORTOS[fecha.getDay()]}</div>
                <div className="num">{fecha.getDate()}</div>
                {fecha.getDay() === 0 && <div className="sun-dot" />}
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
        {hayPromoParaDuracion(deporte, duracion) && (
          <div className="promo-strip">{domingo ? 'Domingo — promo todo el día' : 'Promo 5:00 PM — 6:00 PM'}</div>
        )}

        <div className="slot-grid">
          {horasQueCaben(duracion).map((h) => {
            const ocupadas = mesasOcupadas(deporte, dia, h)
            const lleno = ocupadas >= d.mesas
            const promo = esHorarioPromo(deporte, domingo, h, duracion)
            const aviso = lleno ? null : avisoPocosLugares(deporte, d.mesas - ocupadas)
            const clase = 'slot' + (lleno ? ' full' : '') + (promo && !lleno ? ' promo' : '') + (hora === h && !lleno ? ' selected' : '')
            return (
              <button
                key={h}
                type="button"
                className={clase}
                disabled={lleno}
                aria-pressed={hora === h && !lleno}
                onClick={() => despachar({ tipo: 'elegirHora', hora: h })}
              >
                <div className="t">{formatoHora(h)}</div>
                <div className="p">{lleno ? 'Lleno' : formatoDinero(precioPara(deporte, personas, duracion, promo))}</div>
                {aviso && <div className="low">{aviso}</div>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => despachar({ tipo: 'irAPaso', paso: 1 })}>
          Atrás
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={hora === null}
          onClick={() => despachar({ tipo: 'irAPaso', paso: 3 })}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
