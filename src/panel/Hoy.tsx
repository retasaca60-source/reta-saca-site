// Hoy: cómo están las mesas ahora, quién falta por sentar, anotar a un cliente
// sin reserva y la lista del día.

import { useEffect, useState } from 'react'
import { servicio, type Usuario } from '../datos'
import { mensajeDeError, usarDatos } from '../mecanismos/datos/usarDatos'
import { ORDEN_DEPORTES, type Configuracion, type DeporteId, type Duracion } from '../negocio/configuracion'
import { fin, ocupaMesa, type Reserva } from '../negocio/reserva'
import { ahoraEnSonora, fechaLarga, formatoHora, sumarDias } from '../negocio/tiempo'
import { FilaReserva } from './FilaReserva'

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
          <AnotarSinReserva config={config} />
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

function AnotarSinReserva({ config }: { config: Configuracion }) {
  const [abierto, setAbierto] = useState(false)
  const [deporte, setDeporte] = useState<DeporteId>('pingpong')
  const [duracion, setDuracion] = useState<Duracion>(60)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const duraciones = config.deportes[deporte].duraciones

  if (!abierto) {
    return (
      <button type="button" className="panel-boton primario" onClick={() => setAbierto(true)}>
        + Anotar cliente sin reserva
      </button>
    )
  }

  const anotar = async () => {
    setOcupado(true)
    setError(null)
    try {
      await servicio.anotarSinReserva({ deporte, duracion, nombre, whatsapp })
      setAbierto(false)
      setNombre('')
      setWhatsapp('')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="panel-tarjeta anotar">
      <h3>Cliente sin reserva · empieza ahora</h3>
      <div className="fila-detalle sin-borde">
        <select
          value={deporte}
          onChange={(e) => {
            const nuevo = e.target.value as DeporteId
            setDeporte(nuevo)
            if (!config.deportes[nuevo].duraciones.includes(duracion)) setDuracion(config.deportes[nuevo].duraciones[0])
          }}
        >
          {ORDEN_DEPORTES.map((id) => (
            <option key={id} value={id}>
              {config.deportes[id].nombre}
            </option>
          ))}
        </select>
        <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value) as Duracion)}>
          {duraciones.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
        <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input type="tel" placeholder="WhatsApp (opcional)" maxLength={10} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))} />
        <button type="button" className="panel-boton primario" disabled={ocupado} onClick={anotar}>
          Anotar
        </button>
        <button type="button" className="panel-boton" onClick={() => setAbierto(false)}>
          Cerrar
        </button>
      </div>
      <p className="nota">Se cobra en el local con "Cobrar" y se sienta con "Sentar".</p>
      {error && <p className="panel-error">{error}</p>}
    </div>
  )
}
