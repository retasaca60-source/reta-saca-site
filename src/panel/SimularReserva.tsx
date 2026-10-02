// Solo en la demostración: hacer como si un cliente reservara en línea, sin
// salir del panel. Pasa por las mismas reglas que el sitio (horario, corte,
// mesas libres, el límite de apartados sin pagar) porque usa el mismo servicio;
// solo se salta las pantallas. Sirve para probar el panel con el reloj de
// prueba: reservar para las 7, adelantar la hora y ver qué pasa.
//
// Va en un <dialog>: se pinta por encima de todo (capa superior del
// navegador), así no la tapa ningún panel ni depende de z-index.

import { useCallback, useEffect, useRef, useState } from 'react'
import { pagoSimulado, servicio, type HorarioDisponible } from '../datos'
import { mensajeDeError } from '../mecanismos/datos/usarDatos'
import { ORDEN_DEPORTES, type Configuracion, type DeporteId, type Duracion, type Partes } from '../negocio/configuracion'
import { formatoDinero } from '../negocio/formato'
import { ahoraEnSonora, fechaLarga, formatoDuracion, formatoHora, sumarDias } from '../negocio/tiempo'

const NOMBRES = ['María L.', 'José R.', 'Valeria G.', 'Daniel M.', 'Fernanda S.', 'Luis A.', 'Camila T.', 'Diego P.', 'Ana Sofía', 'Emilio V.']
const alAzar = <T,>(lista: T[]) => lista[Math.floor(Math.random() * lista.length)]
const whatsappDeEjemplo = () => '662' + String(Math.floor(1_000_000 + Math.random() * 8_999_999))

export function SimularReserva() {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [abierto, setAbierto] = useState(false)

  const abrir = () => {
    setAbierto(true)
    dialogo.current?.showModal()
  }
  const cerrar = () => {
    dialogo.current?.close()
    setAbierto(false)
  }

  return (
    <>
      <button type="button" className="panel-boton primario" onClick={abrir}>
        Simular reserva en línea
      </button>
      <dialog ref={dialogo} className="simular" onClose={() => setAbierto(false)} aria-labelledby="simular-titulo">
        {abierto && <Formulario cerrar={cerrar} />}
      </dialog>
    </>
  )
}

function Formulario({ cerrar }: { cerrar: () => void }) {
  const hoy = ahoraEnSonora().fecha
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [deporte, setDeporte] = useState<DeporteId>('pingpong')
  const [fecha, setFecha] = useState(hoy)
  const [duracion, setDuracion] = useState<Duracion>(60)
  const [horarios, setHorarios] = useState<HorarioDisponible[] | null>(null)
  const [inicio, setInicio] = useState<number | null>(null)
  const [partes, setPartes] = useState<Partes>(1)
  const [pagada, setPagada] = useState(true)
  const [nombre, setNombre] = useState(() => alAzar(NOMBRES))
  const [whatsapp, setWhatsapp] = useState(whatsappDeEjemplo)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecha, setHecha] = useState<string | null>(null)

  const [errorConfig, setErrorConfig] = useState<string | null>(null)
  const cargarConfig = useCallback(() => {
    setErrorConfig(null)
    servicio.configuracion().then(setConfig, (e) => setErrorConfig(mensajeDeError(e)))
  }, [])
  useEffect(cargarConfig, [cargarConfig])

  // Los horarios se piden de nuevo con cada cambio, como en el sitio. Si se
  // cambia rápido de deporte o de día, solo cuenta la ÚLTIMA respuesta pedida:
  // antes una respuesta atrasada podía pintar horarios de otra selección.
  const turno = useRef(0)
  const pedirHorarios = useCallback(() => {
    const mio = ++turno.current
    setHorarios(null)
    setInicio(null)
    servicio.disponibilidad(deporte, fecha, duracion).then(
      (h) => mio === turno.current && setHorarios(h),
      (e) => mio === turno.current && setError(mensajeDeError(e)),
    )
  }, [deporte, fecha, duracion])
  useEffect(pedirHorarios, [pedirHorarios])

  // Antes, si la configuración no cargaba, se quedaba en "Cargando…" para siempre.
  if (errorConfig) {
    return (
      <div className="simular-cuerpo">
        <p className="panel-error">{errorConfig}</p>
        <footer className="simular-pie">
          <button type="button" className="panel-boton" onClick={cerrar}>
            Cerrar
          </button>
          <button type="button" className="panel-boton primario" onClick={cargarConfig}>
            Reintentar
          </button>
        </footer>
      </div>
    )
  }
  if (!config) return <p className="nota">Cargando…</p>
  const d = config.deportes[deporte]
  const dias = Array.from({ length: config.reglas.diasDeAnticipacion + 1 }, (_, i) => sumarDias(hoy, i))
  const elegido = horarios?.find((h) => h.inicio === inicio)

  const elegirDeporte = (id: DeporteId) => {
    setDeporte(id)
    const durs = config.deportes[id].duraciones
    if (!durs.includes(duracion)) setDuracion(durs.includes(60) ? 60 : durs[0])
    if (!config.deportes[id].seDivide) setPartes(1)
  }

  const reservar = async () => {
    if (inicio === null) return
    setEnviando(true)
    setError(null)
    try {
      const r = await servicio.apartar({ deporte, fecha, inicio, duracion, partes, organizador: { nombre, whatsapp } })
      if (pagada) {
        // Lo mismo que hace el sitio: paga la parte del organizador en la
        // pantalla de pago de la demostración.
        const { url } = await servicio.iniciarPago(r.tokenPrivado, [r.partes[0].id], nombre)
        await pagoSimulado.confirmar(url.split('/').pop()!)
      }
      setHecha(`${r.folio} · ${d.nombre}, ${fechaLarga(fecha)} a las ${formatoHora(inicio)} · ${pagada ? 'pagada' : 'apartada 10 min sin pagar'}`)
      // Lista para la siguiente: otro nombre y otro número.
      setNombre(alAzar(NOMBRES))
      setWhatsapp(whatsappDeEjemplo())
      pedirHorarios()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="simular-cuerpo">
      <header className="simular-cabeza">
        <div>
          <h2 id="simular-titulo">Simular reserva en línea</h2>
          <p className="nota">Como si un cliente reservara en el sitio, con la hora del reloj de prueba.</p>
        </div>
        <button type="button" className="panel-boton icono" aria-label="Cerrar" onClick={cerrar}>
          ✕
        </button>
      </header>

      <div className="simular-campo">
        <span>Deporte</span>
        <div className="segmentado">
          {ORDEN_DEPORTES.map((id) => (
            <button key={id} type="button" className={deporte === id ? 'activo' : ''} onClick={() => elegirDeporte(id)}>
              {config.deportes[id].nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="simular-fila">
        <label className="simular-campo">
          <span>Día</span>
          <select value={fecha} onChange={(e) => setFecha(e.target.value)}>
            {dias.map((f) => (
              <option key={f} value={f}>
                {f === hoy ? 'Hoy' : fechaLarga(f)}
              </option>
            ))}
          </select>
        </label>
        <div className="simular-campo">
          <span>Tiempo</span>
          <div className="segmentado">
            {d.duraciones.map((m) => (
              <button key={m} type="button" className={duracion === m ? 'activo' : ''} onClick={() => setDuracion(m)}>
                {formatoDuracion(m)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="simular-campo">
        <span>Hora</span>
        {!horarios && <p className="nota">Buscando lugar…</p>}
        {horarios && horarios.length === 0 && <p className="nota">Ese día ya no hay horarios para reservar (cerrado o pasó el corte).</p>}
        {horarios && horarios.length > 0 && (
          <div className="simular-horas">
            {horarios.map((h) => (
              <button
                key={h.inicio}
                type="button"
                className="simular-hora"
                aria-pressed={inicio === h.inicio}
                disabled={h.libres < 1}
                onClick={() => setInicio(h.inicio)}
              >
                <strong>{formatoHora(h.inicio)}</strong>
                <small>{h.libres < 1 ? 'Lleno' : `${h.libres} ${h.libres === 1 ? 'libre' : 'libres'} · ${formatoDinero(h.precio)}`}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="simular-fila">
        {d.seDivide && (
          <div className="simular-campo">
            <span>Cómo pagan</span>
            <div className="segmentado">
              {([1, 2, 4] as Partes[]).map((n) => (
                <button key={n} type="button" className={partes === n ? 'activo' : ''} onClick={() => setPartes(n)}>
                  {n === 1 ? 'Todo' : `Entre ${n}`}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="simular-campo">
          <span>Pago</span>
          <div className="segmentado">
            <button type="button" className={pagada ? 'activo' : ''} onClick={() => setPagada(true)}>
              Pagada en línea
            </button>
            <button type="button" className={!pagada ? 'activo' : ''} onClick={() => setPagada(false)}>
              Solo apartada
            </button>
          </div>
        </div>
      </div>

      <div className="simular-fila">
        <label className="simular-campo">
          <span>Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="simular-campo">
          <span>WhatsApp</span>
          <input value={whatsapp} inputMode="numeric" onChange={(e) => setWhatsapp(e.target.value)} />
        </label>
      </div>

      {error && <p className="panel-error">{error}</p>}
      {hecha && <p className="simular-hecha">Reservada: {hecha}</p>}

      <footer className="simular-pie">
        <button type="button" className="panel-boton" onClick={cerrar}>
          Cerrar
        </button>
        <button type="button" className="panel-boton primario grande" disabled={inicio === null || enviando} onClick={reservar}>
          {enviando
            ? 'Reservando…'
            : elegido
              ? `Reservar ${formatoHora(elegido.inicio)} · ${formatoDinero(elegido.precio)}`
              : 'Elige una hora'}
        </button>
      </footer>
    </div>
  )
}
