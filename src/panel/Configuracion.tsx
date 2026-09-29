// Configuración (solo el dueño): mesas y fuera de servicio, precios, promo,
// horario semanal, días cerrados, reglas, WhatsApp del negocio y usuarios.
// Si al guardar alguna reserva futura se queda sin mesa, se avisa y NO se
// guarda hasta que Hugo lo confirme. Nunca se cancela nada solo.

import { useEffect, useState } from 'react'
import { servicio, type Conflicto, type Rol } from '../datos'
import { mensajeDeError, usarDatos } from '../mecanismos/datos/usarDatos'
import { ORDEN_DEPORTES, type Configuracion as Config, type Duracion } from '../negocio/configuracion'
import { DIAS_LARGOS, etiquetaFecha, formatoHora, horaDe24, minutosDe } from '../negocio/tiempo'

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]

export function Configuracion() {
  const { datos: guardada, error } = usarDatos(() => servicio.configuracion(), [])
  const [c, setC] = useState<Config | null>(null)
  const [conflictos, setConflictos] = useState<Conflicto[]>([])
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [nuevoCerrado, setNuevoCerrado] = useState('')

  // Se copia UNA vez para editar; si otra pestaña guarda, no pisa lo que Hugo está escribiendo.
  useEffect(() => {
    if (guardada && !c) setC(structuredClone(guardada))
  }, [guardada, c])

  if (error) return <p className="panel-error">{error}</p>
  if (!c) return <p>Cargando…</p>

  const cambiar = (f: (x: Config) => void) => {
    const copia = structuredClone(c)
    f(copia)
    setC(copia)
    setMensaje(null)
    setConflictos([])
  }

  const guardar = async (aunqueHayaConflictos = false) => {
    setErrorGuardar(null)
    try {
      const r = await servicio.guardarConfiguracion(c, aunqueHayaConflictos)
      setConflictos(r.guardada ? [] : r.conflictos)
      setMensaje(r.guardada ? 'Guardado.' : null)
    } catch (e) {
      setErrorGuardar(mensajeDeError(e))
    }
  }

  const numero = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

  return (
    <div className="panel-config">
      <div className="panel-titulo">
        <h1>Configuración</h1>
        <button type="button" className="panel-boton primario" onClick={() => guardar()}>
          Guardar cambios
        </button>
        {mensaje && <span className="nota bien">{mensaje}</span>}
      </div>
      {errorGuardar && <p className="panel-error">{errorGuardar}</p>}
      {conflictos.length > 0 && (
        <div className="panel-tarjeta conflictos">
          <h3>Con estos cambios, algunas reservas se quedan sin mesa o fuera de horario</h3>
          <ul>
            {conflictos.map((x) => (
              <li key={`${x.deporte}${x.fecha}${x.inicio}`}>
                {c.deportes[x.deporte].nombre} · {etiquetaFecha(x.fecha)} {formatoHora(x.inicio)}: {x.reservas} {x.reservas === 1 ? 'reserva' : 'reservas'} y{' '}
                {x.mesas === 0 ? 'el local estaría cerrado' : `solo ${x.mesas} mesas`}
              </li>
            ))}
          </ul>
          <p className="nota">No se cancela ninguna reserva sola. Si guardas, habla con esos clientes.</p>
          <button type="button" className="panel-boton peligro" onClick={() => guardar(true)}>
            Guardar de todos modos
          </button>
        </div>
      )}

      <section className="panel-seccion">
        <h2>Mesas y precios</h2>
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Deporte</th>
              <th>Mesas</th>
              <th>Fuera de servicio</th>
              {([30, 60, 90, 120] as Duracion[]).map((m) => (
                <th key={m}>{m} min</th>
              ))}
              <th>Promo 60 min</th>
            </tr>
          </thead>
          <tbody>
            {ORDEN_DEPORTES.map((id) => {
              const d = c.deportes[id]
              return (
                <tr key={id}>
                  <td>{d.nombre}</td>
                  <td>
                    <input className="corto" type="number" min={0} max={50} value={d.mesas} onChange={(e) => cambiar((x) => void (x.deportes[id].mesas = numero(e.target.value)))} />
                  </td>
                  <td>
                    <div className="mesas-casillas">
                      {Array.from({ length: d.mesas }, (_, i) => i + 1).map((n) => (
                        <label key={n} title={`${d.clave} ${n}`}>
                          <input
                            type="checkbox"
                            checked={d.fueraDeServicio.includes(n)}
                            onChange={(e) =>
                              cambiar((x) => {
                                const f = x.deportes[id].fueraDeServicio
                                x.deportes[id].fueraDeServicio = e.target.checked ? [...f, n] : f.filter((k) => k !== n)
                              })
                            }
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                  </td>
                  {([30, 60, 90, 120] as Duracion[]).map((m) => (
                    <td key={m}>
                      {d.duraciones.includes(m) ? (
                        <input className="corto" type="number" min={1} value={d.precios[m] ?? ''} onChange={(e) => cambiar((x) => void (x.deportes[id].precios[m] = numero(e.target.value)))} />
                      ) : (
                        <span className="nota">—</span>
                      )}
                    </td>
                  ))}
                  <td>
                    {d.precioPromo === null ? (
                      <span className="nota">sin promo</span>
                    ) : (
                      <input className="corto" type="number" min={1} value={d.precioPromo} onChange={(e) => cambiar((x) => void (x.deportes[id].precioPromo = numero(e.target.value)))} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="nota">Cambiar un precio no toca las reservas ya hechas: cada una conserva el suyo.</p>
      </section>

      <section className="panel-seccion">
        <h2>Promo</h2>
        <label className="casilla-panel">
          <input type="checkbox" checked={c.promo.activa} onChange={(e) => cambiar((x) => void (x.promo.activa = e.target.checked))} />
          Promo activa: reservas de {c.promo.duracion} min que empiezan a las {c.promo.inicios.map(formatoHora).join(' o ')}, todos los días.
        </label>
      </section>

      <section className="panel-seccion">
        <h2>Horario</h2>
        <table className="panel-tabla horario">
          <tbody>
            {ORDEN_DIAS.map((dia) => {
              const bloques = c.horario[dia] ?? []
              return (
                <tr key={dia}>
                  <td className="capital">{DIAS_LARGOS[dia]}</td>
                  <td>
                    {bloques.length === 0 && <span className="nota">Cerrado</span>}
                    {bloques.map((b, i) => (
                      <span key={i} className="bloque">
                        <input type="time" step={1800} value={horaDe24(b.desde)} onChange={(e) => cambiar((x) => void (x.horario[dia][i].desde = minutosDe(e.target.value)))} />
                        –
                        <input type="time" step={1800} value={horaDe24(b.hasta)} onChange={(e) => cambiar((x) => void (x.horario[dia][i].hasta = minutosDe(e.target.value)))} />
                        <button type="button" className="panel-boton discreto" onClick={() => cambiar((x) => void x.horario[dia].splice(i, 1))}>
                          quitar
                        </button>
                      </span>
                    ))}
                    <button type="button" className="panel-boton discreto" onClick={() => cambiar((x) => void (x.horario[dia] = [...(x.horario[dia] ?? []), { desde: 17 * 60, hasta: 22 * 60 }]))}>
                      + bloque
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="nota">Cada reserva tiene que terminar antes del cierre de su bloque.</p>

        <h3>Días cerrados</h3>
        <div className="fila-detalle sin-borde">
          <input type="date" value={nuevoCerrado} onChange={(e) => setNuevoCerrado(e.target.value)} />
          <button
            type="button"
            className="panel-boton"
            disabled={!nuevoCerrado || c.diasCerrados.includes(nuevoCerrado)}
            onClick={() => {
              cambiar((x) => void (x.diasCerrados = [...x.diasCerrados, nuevoCerrado].sort()))
              setNuevoCerrado('')
            }}
          >
            Cerrar ese día
          </button>
          {c.diasCerrados.map((f) => (
            <span key={f} className="etiqueta neutra">
              {etiquetaFecha(f)}{' '}
              <button type="button" className="panel-boton discreto" onClick={() => cambiar((x) => void (x.diasCerrados = x.diasCerrados.filter((k) => k !== f)))}>
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="panel-seccion">
        <h2>Reglas y contacto</h2>
        <div className="reglas-panel">
          {(
            [
              ['diasDeAnticipacion', 'Días que se puede reservar hacia adelante'],
              ['minutosDeCorte', 'Para hoy: minutos antes del inicio'],
              ['minutosDeApartado', 'Minutos que se aparta la mesa al pagar'],
              ['horasParaCancelar', 'Horas antes para cancelar con devolución'],
              ['minutosDeTolerancia', 'Minutos de tolerancia al llegar'],
              ['reservasActivasPorWhatsapp', 'Reservas activas por WhatsApp'],
            ] as const
          ).map(([llave, texto]) => (
            <label key={llave}>
              {texto}
              <input className="corto" type="number" min={0} value={c.reglas[llave]} onChange={(e) => cambiar((x) => void (x.reglas[llave] = numero(e.target.value)))} />
            </label>
          ))}
          <label>
            WhatsApp del negocio (10 dígitos)
            <input type="tel" maxLength={10} value={c.whatsappNegocio} placeholder="Pendiente de Hugo" onChange={(e) => cambiar((x) => void (x.whatsappNegocio = e.target.value.replace(/\D/g, '')))} />
          </label>
        </div>
      </section>

      <Usuarios />
    </div>
  )
}

function Usuarios() {
  const { datos: usuarios, error } = usarDatos(() => servicio.usuarios(), [])
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [rol, setRol] = useState<Rol>('recepcion')
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const hacer = async (f: () => Promise<unknown>) => {
    setErrorAccion(null)
    try {
      await f()
    } catch (e) {
      setErrorAccion(mensajeDeError(e))
    }
  }

  return (
    <section className="panel-seccion">
      <h2>Quién entra al panel</h2>
      {error && <p className="panel-error">{error}</p>}
      <table className="panel-tabla">
        <tbody>
          {usuarios?.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre}</td>
              <td>{u.usuario}</td>
              <td>{u.rol === 'dueno' ? 'Dueño' : 'Recepción'}</td>
              <td className="derecha">
                <button type="button" className="panel-boton discreto" onClick={() => confirm(`¿Quitarle el acceso a ${u.nombre}?`) && hacer(() => servicio.quitarUsuario(u.id))}>
                  Quitar acceso
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fila-detalle sin-borde">
        <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input
          type="text"
          placeholder="Usuario (ej. recepcion)"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <input type="password" placeholder="Contraseña" autoComplete="new-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          <option value="recepcion">Recepción</option>
          <option value="dueno">Dueño</option>
        </select>
        <button
          type="button"
          className="panel-boton"
          disabled={nombre.trim().length < 2 || !usuario.trim() || !contrasena}
          onClick={() =>
            hacer(async () => {
              await servicio.agregarUsuario({ nombre: nombre.trim(), usuario: usuario.trim(), rol }, contrasena)
              setNombre('')
              setUsuario('')
              setContrasena('')
            })
          }
        >
          Dar acceso
        </button>
      </div>
      <p className="nota">
        Cada persona entra con su propio usuario: así queda registrado quién marcó cada pago. La contraseña se la pones tú aquí
        (mínimo 8 caracteres) y se la dices en persona; no se manda ningún correo.
      </p>
      {errorAccion && <p className="panel-error">{errorAccion}</p>}
    </section>
  )
}
