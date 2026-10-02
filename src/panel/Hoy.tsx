// Hoy: el plano del local. Las mesas vistas desde arriba, quién juega en cada
// una y hasta qué hora, quién llegó y falta sentar, la caja del mostrador y la
// lista del día. Tocar una mesa abre sus datos a la derecha con lo que
// recepción puede hacer con ella.
//
// El orden es el del mostrador: lo primero que se mira es qué mesa está libre;
// por eso el plano va primero y la lista y la caja quedan a una pestaña.

import { useEffect, useState } from 'react'
import { servicio } from '../datos'
import { mensajeDeError, usarDatos } from '../mecanismos/datos/usarDatos'
import { ORDEN_DEPORTES, type Configuracion, type DeporteId } from '../negocio/configuracion'
import { formatoDinero, whatsappLegible } from '../negocio/formato'
import { fin, ocupaMesa, pagado, pendiente, total, type Reserva } from '../negocio/reserva'
import { DIAS_CORTOS, ahoraEnSonora, diaDeLaSemana, fechaLarga, formatoDuracion, formatoHora, sumarDias } from '../negocio/tiempo'
import { DibujoMesa } from './DibujoMesa'
import { FilaReserva } from './FilaReserva'
import { IconoAnterior, IconoSiguiente } from './iconos'
import { RegistrarEnMostrador } from './RegistrarEnMostrador'

type Pestana = 'mesas' | 'reservas' | 'mostrador'

export function Hoy() {
  const [fecha, setFecha] = useState(ahoraEnSonora().fecha)
  const lunes = sumarDias(fecha, -((diaDeLaSemana(fecha) + 6) % 7))
  const { datos, error } = usarDatos(
    () => Promise.all([servicio.configuracion(), servicio.reservasEntre(lunes, sumarDias(lunes, 6))]),
    [lunes],
  )
  const [pestana, setPestana] = useState<Pestana>('mesas')
  const [deporte, setDeporte] = useState<DeporteId>('pingpong')
  const [elegida, setElegida] = useState<string | null>(null)
  const [paraLaCaja, setParaLaCaja] = useState<{ deporte: DeporteId; mesa: string } | undefined>()
  // El plano de "ahora" se mueve con el reloj aunque nadie toque nada.
  const [, setTic] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (error) return <p className="panel-error">{error}</p>
  if (!datos) return <p className="nota">Cargando…</p>
  const [config, semana] = datos
  const ahora = ahoraEnSonora()
  const esHoy = fecha === ahora.fecha
  const delDia = semana.filter((r) => r.fecha === fecha)
  const activas = delDia.filter((r) => r.estado !== 'cancelada')
  const canceladas = delDia.filter((r) => r.estado === 'cancelada')
  // El plano y la caja son de "ahora": otro día solo tiene la lista.
  const vista: Pestana = esHoy ? pestana : 'reservas'

  const irADia = (f: string) => {
    setFecha(f)
    setElegida(null)
  }

  return (
    <div className="hoy">
      <header className="hoy-cabeza">
        <div>
          <h1>{esHoy ? 'Hoy' : nombreCorto(fecha)}</h1>
          <p>
            {fechaLarga(fecha)}
            {esHoy && ` · ${formatoHora(ahora.minutos)}`}
          </p>
        </div>
        <div className="hoy-dias" role="group" aria-label="Cambiar de día">
          <button type="button" className="panel-boton icono" aria-label="Día anterior" onClick={() => irADia(sumarDias(fecha, -1))}>
            <IconoAnterior />
          </button>
          <button type="button" className="panel-boton" disabled={esHoy} onClick={() => irADia(ahora.fecha)}>
            Hoy
          </button>
          <button type="button" className="panel-boton icono" aria-label="Día siguiente" onClick={() => irADia(sumarDias(fecha, 1))}>
            <IconoSiguiente />
          </button>
        </div>
      </header>

      <nav className="pestanas" aria-label="Vistas del día">
        {esHoy && (
          <button type="button" aria-pressed={vista === 'mesas'} onClick={() => setPestana('mesas')}>
            Mesas
          </button>
        )}
        <button type="button" aria-pressed={vista === 'reservas'} onClick={() => setPestana('reservas')}>
          Reservas del día <span className="pestana-cuenta">{activas.length}</span>
        </button>
        {esHoy && (
          <button
            type="button"
            aria-pressed={vista === 'mostrador'}
            onClick={() => {
              setParaLaCaja(undefined)
              setPestana('mostrador')
            }}
          >
            Cliente en el local
          </button>
        )}
      </nav>

      {vista === 'mesas' && (
        <Plano
          config={config}
          reservas={delDia}
          semana={semana}
          fecha={fecha}
          lunes={lunes}
          deporte={deporte}
          setDeporte={(d) => {
            setDeporte(d)
            setElegida(null)
          }}
          elegida={elegida}
          setElegida={setElegida}
          registrarAqui={(mesa) => {
            setParaLaCaja({ deporte, mesa })
            setPestana('mostrador')
          }}
        />
      )}

      {vista === 'reservas' && (
        <section className="hoy-lista">
          {activas.length === 0 && <p className="nota">No hay reservas este día.</p>}
          {activas.map((r) => (
            <FilaReserva key={r.id} r={r} config={config} />
          ))}
          {canceladas.length > 0 && (
            <details className="panel-canceladas">
              <summary>Canceladas · {canceladas.length}</summary>
              {canceladas.map((r) => (
                <FilaReserva key={r.id} r={r} config={config} />
              ))}
            </details>
          )}
        </section>
      )}

      {vista === 'mostrador' && (
        <section className="hoy-mostrador">
          <RegistrarEnMostrador key={paraLaCaja?.mesa ?? 'libre'} config={config} reservas={delDia} inicial={paraLaCaja} />
        </section>
      )}
    </div>
  )
}

const nombreCorto = (fecha: string) => {
  const largo = fechaLarga(fecha)
  return largo.charAt(0).toUpperCase() + largo.slice(1).split(' ')[0]
}

// ─── El plano ────────────────────────────────────────────────────────────

type EstadoMesa = 'libre' | 'en-juego' | 'fuera'

interface Mesa {
  etiqueta: string
  numero: number
  estado: EstadoMesa
  quien?: Reserva
}

function Plano({
  config,
  reservas,
  semana,
  fecha,
  lunes,
  deporte,
  setDeporte,
  elegida,
  setElegida,
  registrarAqui,
}: {
  config: Configuracion
  reservas: Reserva[]
  semana: Reserva[]
  fecha: string
  lunes: string
  deporte: DeporteId
  setDeporte: (d: DeporteId) => void
  elegida: string | null
  setElegida: (m: string | null) => void
  registrarAqui: (mesa: string) => void
}) {
  const ahora = ahoraEnSonora()
  const enJuego = (id: DeporteId) =>
    reservas.filter((r) => r.deporte === id && ocupaMesa(r, ahora.ms) && r.inicio <= ahora.minutos && fin(r) > ahora.minutos)
  const d = config.deportes[deporte]
  const jugando = enJuego(deporte)
  const porSentar = jugando.filter((r) => !r.mesa)
  const mesas: Mesa[] = Array.from({ length: d.mesas }, (_, i) => {
    const numero = i + 1
    const etiqueta = `${d.clave} ${numero}`
    const quien = jugando.find((r) => r.mesa === etiqueta)
    return { etiqueta, numero, quien, estado: d.fueraDeServicio.includes(numero) ? 'fuera' : quien ? 'en-juego' : 'libre' }
  })
  const mesa = mesas.find((m) => m.etiqueta === elegida) ?? null

  return (
    <div className="plano">
      <div className="plano-salon">
        <div className="plano-filtros" role="group" aria-label="Deporte">
          {ORDEN_DEPORTES.map((id) => {
            const ocupadas = enJuego(id).filter((r) => r.mesa).length
            return (
              <button key={id} type="button" className="pastilla" aria-pressed={deporte === id} onClick={() => setDeporte(id)}>
                {config.deportes[id].nombre}
                <span className="pastilla-cuenta">
                  {ocupadas}/{config.deportes[id].mesas}
                </span>
              </button>
            )
          })}
        </div>

        {porSentar.length > 0 && (
          <p className="plano-aviso">
            <strong>
              {porSentar.length === 1 ? '1 grupo llegó y falta sentarlo' : `${porSentar.length} grupos por sentar`}:
            </strong>{' '}
            {porSentar.map((r) => `${r.organizador.nombre} (${formatoHora(r.inicio)})`).join(', ')}. Toca una mesa libre para sentarlos.
          </p>
        )}

        <div className="plano-mesas">
          {mesas.map((m) => (
            <button
              key={m.etiqueta}
              type="button"
              className={`mesa ${m.estado}`}
              aria-pressed={elegida === m.etiqueta}
              onClick={() => setElegida(elegida === m.etiqueta ? null : m.etiqueta)}
            >
              <span className="mesa-tabla">
                <DibujoMesa deporte={deporte} enJuego={m.estado === 'en-juego'} />
                <strong>{m.etiqueta}</strong>
                <small>
                  {m.estado === 'fuera'
                    ? 'Fuera de servicio'
                    : m.quien
                      ? `${m.quien.organizador.nombre} · hasta ${formatoHora(fin(m.quien))}`
                      : 'Libre'}
                </small>
                {m.estado === 'en-juego' && <span className="mesa-cinta">En juego</span>}
              </span>
            </button>
          ))}
        </div>

        <p className="plano-leyenda">
          <span className="leyenda libre">Libre: el juego solo</span>
          <span className="leyenda en-juego">En juego: con lo de los jugadores</span>
          <span className="leyenda fuera">Fuera de servicio</span>
        </p>
      </div>

      <aside className="plano-lado">
        <DatosDeMesa
          mesa={mesa}
          config={config}
          deporte={deporte}
          porSentar={porSentar}
          libres={mesas.filter((m) => m.estado === 'libre').length}
          jugando={jugando.filter((r) => r.mesa).length}
          registrarAqui={registrarAqui}
        />
        <ReservasDeLaSemana semana={semana} lunes={lunes} hoy={fecha} />
      </aside>
    </div>
  )
}

/** La columna derecha: lo de la mesa tocada, o el resumen si no hay ninguna. */
function DatosDeMesa({
  mesa,
  config,
  deporte,
  porSentar,
  libres,
  jugando,
  registrarAqui,
}: {
  mesa: Mesa | null
  config: Configuracion
  deporte: DeporteId
  porSentar: Reserva[]
  libres: number
  jugando: number
  registrarAqui: (mesa: string) => void
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ahora = ahoraEnSonora()
  const d = config.deportes[deporte]

  if (!mesa) {
    return (
      <section className="lado-tarjeta">
        <h2>{d.nombre} ahora</h2>
        <dl className="datos">
          <div>
            <dt>Libres</dt>
            <dd>{libres}</dd>
          </div>
          <div>
            <dt>En juego</dt>
            <dd>{jugando}</dd>
          </div>
          <div>
            <dt>Por sentar</dt>
            <dd>{porSentar.length}</dd>
          </div>
        </dl>
        <p className="nota">Toca una mesa para ver quién juega o para sentar a alguien.</p>
      </section>
    )
  }

  const sentar = async (r: Reserva) => {
    setOcupado(r.id)
    setError(null)
    try {
      await servicio.asignarMesa(r.id, mesa.etiqueta)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setOcupado(null)
    }
  }

  const r = mesa.quien
  return (
    <section className="lado-tarjeta">
      <div className="lado-cabeza">
        <h2>{mesa.etiqueta}</h2>
        <span className={`estado ${mesa.estado}`}>{mesa.estado === 'en-juego' ? 'En juego' : mesa.estado === 'fuera' ? 'Fuera de servicio' : 'Libre'}</span>
      </div>

      {r && (
        <>
          <p className="lado-nombre">
            {r.organizador.nombre}
            <small>{r.folio}</small>
          </p>
          <dl className="datos">
            <div>
              <dt>Horario</dt>
              <dd>
                {formatoHora(r.inicio)} – {formatoHora(fin(r))}
              </dd>
            </div>
            <div>
              <dt>Le quedan</dt>
              <dd>{formatoDuracion(Math.max(0, fin(r) - ahora.minutos))}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatoDinero(total(r))}</dd>
            </div>
            <div>
              <dt>{pendiente(r) > 0 ? 'Falta cobrar' : 'Pagado'}</dt>
              <dd className={pendiente(r) > 0 ? 'falta' : 'bien'}>{formatoDinero(pendiente(r) > 0 ? pendiente(r) : pagado(r))}</dd>
            </div>
            {r.organizador.whatsapp && (
              <div>
                <dt>WhatsApp</dt>
                <dd>{whatsappLegible(r.organizador.whatsapp)}</dd>
              </div>
            )}
          </dl>
          <FilaReserva key={r.id} r={r} config={config} soloAcciones />
        </>
      )}

      {mesa.estado === 'libre' && (
        <>
          {porSentar.length > 0 ? (
            <div className="lado-sentar">
              <p className="nota">Llegaron y falta sentarlos:</p>
              {porSentar.map((g) => (
                <div key={g.id} className="lado-grupo">
                  <span>
                    <strong>{g.organizador.nombre}</strong>
                    <small>
                      {formatoHora(g.inicio)} – {formatoHora(fin(g))}
                    </small>
                  </span>
                  <button type="button" className="panel-boton primario" disabled={ocupado !== null} onClick={() => sentar(g)}>
                    {ocupado === g.id ? 'Sentando…' : 'Sentar aquí'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="nota">Nadie espera mesa de {d.nombre} ahora.</p>
          )}
          <button type="button" className="panel-boton grande ancho" onClick={() => registrarAqui(mesa.etiqueta)}>
            Registrar a alguien sin reserva aquí
          </button>
        </>
      )}

      {mesa.estado === 'fuera' && <p className="nota">Se vuelve a poner en servicio en Ajustes.</p>}
      {error && <p className="panel-error">{error}</p>}
    </section>
  )
}

/** Cuántas reservas hay cada día de esta semana: lo que el dueño mira de reojo. */
function ReservasDeLaSemana({ semana, lunes, hoy }: { semana: Reserva[]; lunes: string; hoy: string }) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const cuenta = dias.map((f) => semana.filter((r) => r.fecha === f && r.estado !== 'cancelada').length)
  const mayor = Math.max(1, ...cuenta)
  const totalSemana = cuenta.reduce((s, n) => s + n, 0)
  return (
    <section className="lado-tarjeta">
      <h2>Reservas de la semana</h2>
      <p className="semana-cifra">
        {totalSemana}
        <small>{totalSemana === 1 ? 'reserva' : 'reservas'} de lunes a domingo</small>
      </p>
      <ol className="semana-barras" aria-label="Reservas por día">
        {dias.map((f, i) => (
          <li key={f} className={f === hoy ? 'hoy' : ''} title={`${cuenta[i]} el ${fechaLarga(f)}`}>
            <span className="barra" aria-hidden>
              <span style={{ height: `${(cuenta[i] / mayor) * 100}%` }} />
            </span>
            <span className="barra-cuenta">{cuenta[i]}</span>
            <span className="barra-dia">{DIAS_CORTOS[diaDeLaSemana(f)].slice(0, 2)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
