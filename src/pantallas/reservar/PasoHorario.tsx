// Paso 2: día, cuánto tiempo y a qué hora, con la disponibilidad del servicio.

import { useEffect, type Dispatch } from 'react'
import { servicio } from '../../datos'
import { usarDatos } from '../../mecanismos/datos/usarDatos'
import type { Accion, Borrador } from '../../mecanismos/reserva/estado'
import type { Configuracion } from '../../negocio/configuracion'
import { avisoPocosLugares } from '../../negocio/disponibilidad'
import { formatoDinero } from '../../negocio/formato'
import { diasReservables } from '../../negocio/horario'
import { ahoraEnSonora, DIAS_CORTOS, diaDeLaSemana, formatoDuracion, formatoHora, horaDe24, sumarDias } from '../../negocio/tiempo'
import { IconoAtras } from '../../vista/Iconos'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

export function PasoHorario({ borrador, despachar, config }: Props) {
  const { fecha, duracion, inicio } = borrador
  // Este paso solo se abre con deporte y forma de pago elegidos.
  const deporte = borrador.deporte!
  const d = config.deportes[deporte]
  const ahora = ahoraEnSonora()
  const dias = diasReservables(config, ahora)
  const { datos: horarios, cargando, error } = usarDatos(() => servicio.disponibilidad(deporte, fecha, duracion), [deporte, fecha, duracion])

  // Si la hora elegida ya no está libre (se llenó, o pasó el corte mientras
  // decidía), se suelta: así no se sigue con una hora que la pantalla dice llena.
  useEffect(() => {
    if (inicio === null || !horarios) return
    if (!horarios.some((x) => x.inicio === inicio && x.libres > 0)) despachar({ tipo: 'soltarHora' })
  }, [horarios, inicio, despachar])

  const hayPromo = horarios?.some((x) => x.conPromo)

  return (
    <>
      <button type="button" className="volver" onClick={() => despachar({ tipo: 'irAPaso', paso: 1, config })}>
        <IconoAtras /> Deporte
      </button>
      <div className="fila-titulo">
        <h1 className="titulo-grande">¿Cuándo?</h1>
      </div>

      <div className="dias" role="group" aria-label="Día">
        {dias.map((dia) => {
          const [, , num] = dia.fecha.split('-').map(Number)
          const nombre = dia.fecha === ahora.fecha ? 'Hoy' : dia.fecha === sumarDias(ahora.fecha, 1) ? 'Mañana' : DIAS_CORTOS[diaDeLaSemana(dia.fecha)]
          return (
            <button
              key={dia.fecha}
              type="button"
              className="dia"
              aria-pressed={fecha === dia.fecha}
              disabled={dia.cerrado}
              onClick={() => despachar({ tipo: 'elegirFecha', fecha: dia.fecha })}
            >
              <span className="dia-nombre">{nombre}</span>
              <span className="dia-numero numeros">{num}</span>
              {dia.cerrado && <span className="dia-cerrado">Cerrado</span>}
            </button>
          )
        })}
      </div>

      <h2 className="titulo-seccion">¿Cuánto tiempo?</h2>
      <div className="segmentado" role="group" aria-label="Cuánto tiempo">
        {d.duraciones.map((m) => (
          <button key={m} type="button" aria-pressed={duracion === m} onClick={() => despachar({ tipo: 'elegirDuracion', duracion: m })}>
            {formatoDuracion(m)}
          </button>
        ))}
      </div>

      <h2 className="titulo-seccion">¿A qué hora?</h2>
      {borrador.aviso && (
        <p className="aviso aviso-alerta" role="alert">
          {borrador.aviso}
        </p>
      )}
      {hayPromo && <p className="nota promo">Promo: 1 hora empezando a las 5:00 o 5:30 PM.</p>}
      {error && <p className="aviso aviso-error">{error}</p>}
      {!horarios && cargando && <p className="cargando">Buscando horarios…</p>}
      {horarios && horarios.length === 0 && (
        <p className="nota">No hay horarios este día para {formatoDuracion(duracion)}. Prueba otro día o menos tiempo.</p>
      )}
      {horarios && horarios.length > 0 && (
        <div className="horas" aria-busy={cargando}>
          {horarios.map((x) => {
            const lleno = x.libres < 1
            const aviso = lleno ? null : avisoPocosLugares(config, deporte, x.libres)
            return (
              <button
                key={x.inicio}
                type="button"
                className={'hora' + (x.conPromo && !lleno ? ' con-promo' : '')}
                disabled={lleno}
                aria-pressed={inicio === x.inicio && !lleno}
                data-hora={horaDe24(x.inicio)}
                onClick={() => despachar({ tipo: 'elegirHora', inicio: x.inicio })}
              >
                <span className="hora-valor numeros">{formatoHora(x.inicio)}</span>
                <span className="hora-precio numeros">{lleno ? 'Lleno' : formatoDinero(x.precio)}</span>
                {aviso && <span className="hora-aviso">{aviso}</span>}
              </button>
            )
          })}
        </div>
      )}

      <div className="barra-accion">
        <button type="button" className="boton boton-principal" disabled={inicio === null} onClick={() => despachar({ tipo: 'irAPaso', paso: 3, config })}>
          Continuar
        </button>
      </div>
    </>
  )
}
