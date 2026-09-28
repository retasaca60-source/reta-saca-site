// Hoy: cómo están las mesas ahora, quién falta por sentar, la caja del
// mostrador (registrar y cobrar a quien llega sin reserva) y la lista del día.

import { useEffect, useState } from 'react'
import { servicio, type Usuario } from '../datos'
import { usarDatos } from '../mecanismos/datos/usarDatos'
import { ORDEN_DEPORTES, type Configuracion, type DeporteId } from '../negocio/configuracion'
import { fin, ocupaMesa, type Reserva } from '../negocio/reserva'
import { ahoraEnSonora, fechaLarga, formatoHora, sumarDias } from '../negocio/tiempo'
import { FilaReserva } from './FilaReserva'
import { RegistrarEnMostrador } from './RegistrarEnMostrador'

export function Hoy({ usuario }: { usuario: Usuario }) {
  const [fecha, setFecha] = useState(ahoraEnSonora().fecha)
  const { datos, error } = usarDatos(() => Promise.all([servicio.configuracion(), servicio.reservasEntre(fecha, fecha)]), [fecha])
  // El tablero de "ahora" se mueve con el reloj aunque nadie toque nada.
  const [, setTic] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (error) return <p className="panel-error">{error}</p>
  if (!datos) return <p>Cargando…</p>
  const [config, reservas] = datos
  const ahora = ahoraEnSonora()
  const esHoy = fecha === ahora.fecha
  const activas = reservas.filter((r) => r.estado !== 'cancelada')
  const canceladas = reservas.filter((r) => r.estado === 'cancelada')

  return (
    <div className="panel-hoy">
      <div className="panel-titulo">
        <h1>{esHoy ? 'Hoy' : fechaLarga(fecha)}</h1>
        <div className="panel-dias">
          <button type="button" className="panel-boton" onClick={() => setFecha(sumarDias(fecha, -1))}>
            ←
          </button>
          <button type="button" className="panel-boton" disabled={esHoy} onClick={() => setFecha(ahora.fecha)}>
            Hoy
          </button>
          <button type="button" className="panel-boton" onClick={() => setFecha(sumarDias(fecha, 1))}>
            →
          </button>
        </div>
        <span className="panel-saludo">Hola, {usuario.nombre}</span>
      </div>

      {esHoy && (
        <section className="panel-seccion">
          <h2>Mesas ahora · {formatoHora(ahora.minutos)}</h2>
          <div className="tablero-mesas">
            {ORDEN_DEPORTES.map((id) => (
              <MesasAhora key={id} deporte={id} config={config} reservas={reservas} minuto={ahora.minutos} ms={ahora.ms} />
            ))}
          </div>
          <RegistrarEnMostrador config={config} reservas={reservas} />
        </section>
      )}

      <section className="panel-seccion">
        <h2>
          Reservas · {activas.length}
          {canceladas.length > 0 && <small> ({canceladas.length} canceladas abajo)</small>}
        </h2>
        {activas.length === 0 && <p className="nota">No hay reservas este día.</p>}
        {activas.map((r) => (
          <FilaReserva key={r.id} r={r} config={config} />
        ))}
        {canceladas.length > 0 && (
          <details className="panel-canceladas">
            <summary>Canceladas</summary>
            {canceladas.map((r) => (
              <FilaReserva key={r.id} r={r} config={config} />
            ))}
          </details>
        )}
      </section>
    </div>
  )
}

/** Cada mesa del deporte: libre, con quién está y hasta qué hora, o fuera de servicio. */
function MesasAhora({ deporte, config, reservas, minuto, ms }: { deporte: DeporteId; config: Configuracion; reservas: Reserva[]; minuto: number; ms: number }) {
  const d = config.deportes[deporte]
  const enJuego = reservas.filter((r) => r.deporte === deporte && ocupaMesa(r, ms) && r.inicio <= minuto && fin(r) > minuto)
  const porSentar = enJuego.filter((r) => !r.mesa).length
  return (
    <div className="mesas-deporte">
      <h3>
        {d.nombre}
        {porSentar > 0 && <span className="etiqueta aviso">{porSentar} por sentar</span>}
      </h3>
      <div className="mesas-rejilla">
        {Array.from({ length: d.mesas }, (_, i) => {
          const n = i + 1
          const etiqueta = `${d.clave} ${n}`
          const quien = enJuego.find((r) => r.mesa === etiqueta)
          const estado = d.fueraDeServicio.includes(n) ? 'fuera' : quien ? 'ocupada' : 'libre'
          return (
            <div key={n} className={`mesa-ahora ${estado}`} title={quien ? `${quien.organizador.nombre} hasta ${formatoHora(fin(quien))}` : undefined}>
              <strong>{etiqueta}</strong>
              <small>{estado === 'fuera' ? 'Fuera de servicio' : quien ? `${quien.organizador.nombre} · ${formatoHora(fin(quien))}` : 'Libre'}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}
