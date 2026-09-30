// Una reserva en el panel, con todo lo que recepción puede hacer con ella:
// sentar (asignar mesa), cobrar, extender, cambiar horario, cancelar, liberar
// y mandarle al organizador su link por WhatsApp (RESERVAS.md §10).

import { useState } from 'react'
import { servicio } from '../datos'
import { mensajeDeError } from '../mecanismos/datos/usarDatos'
import { direccion, enlaceWhatsApp } from '../mecanismos/whatsapp/enlaces'
import type { Configuracion, Duracion } from '../negocio/configuracion'
import { formatoDinero, whatsappLegible } from '../negocio/formato'
import { fin, pagado, partesPendientes, pendiente, puedeLiberarPorRetraso, total, type MedioDePago, type Reserva } from '../negocio/reserva'
import { etiquetaFecha, formatoDuracion, formatoHora, horaDe24, minutosDe } from '../negocio/tiempo'

type Panelito = null | 'sentar' | 'cobrar' | 'extender' | 'cambiar' | 'cancelar'

export function FilaReserva({ r, config, conFecha = false }: { r: Reserva; config: Configuracion; conFecha?: boolean }) {
  const [abierto, setAbierto] = useState<Panelito>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const d = config.deportes[r.deporte]
  const cancelada = r.estado === 'cancelada'
  const falta = pendiente(r)

  const hacer = async (f: () => Promise<unknown>) => {
    setOcupado(true)
    setError(null)
    try {
      await f()
      setAbierto(null)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setOcupado(false)
    }
  }

  const alternar = (p: Panelito) => {
    setError(null)
    setAbierto(abierto === p ? null : p)
  }

  return (
    <article className={'fila-reserva' + (cancelada ? ' cancelada' : '')}>
      <div className="fila-principal">
        <div className="fila-hora">
          {conFecha && <small>{etiquetaFecha(r.fecha)}</small>}
          <strong>{formatoHora(r.inicio)}</strong>
          <small>a {formatoHora(fin(r))}</small>
        </div>
        <div className="fila-quien">
          <strong>{r.organizador.nombre}</strong>
          <small>
            {d.nombre} · {formatoDuracion(r.duracion)} · {r.folio}
            {r.organizador.whatsapp && ` · ${whatsappLegible(r.organizador.whatsapp)}`}
          </small>
        </div>
        <div className="fila-etiquetas">
          <Etiquetas r={r} config={config} />
        </div>
        <div className="fila-dinero">
          <strong>{formatoDinero(total(r))}</strong>
          <small>{falta > 0 && !cancelada ? `faltan ${formatoDinero(falta)}` : `pagado ${formatoDinero(pagado(r))}`}</small>
        </div>
      </div>

      {!cancelada && (
        <div className="fila-acciones">
          <button type="button" className={'panel-boton' + (abierto === 'sentar' ? ' activo' : '')} onClick={() => alternar('sentar')}>
            {r.mesa ? `Mesa ${r.mesa}` : 'Sentar'}
          </button>
          {falta > 0 && (
            <button type="button" className={'panel-boton' + (abierto === 'cobrar' ? ' activo' : '')} onClick={() => alternar('cobrar')}>
              Cobrar {formatoDinero(falta)}
            </button>
          )}
          {r.estado === 'confirmada' && (
            <button type="button" className={'panel-boton' + (abierto === 'extender' ? ' activo' : '')} onClick={() => alternar('extender')}>
              Extender
            </button>
          )}
          <button type="button" className={'panel-boton' + (abierto === 'cambiar' ? ' activo' : '')} onClick={() => alternar('cambiar')}>
            Cambiar horario
          </button>
          {puedeLiberarPorRetraso(r, config, Date.now()) && (
            <button type="button" className="panel-boton" disabled={ocupado} onClick={() => confirm(`¿Liberar la mesa de ${r.organizador.nombre}? No llegaron en ${config.reglas.minutosDeTolerancia} minutos. No hay devolución.`) && hacer(() => servicio.liberarPorRetraso(r.id))}>
              Liberar (no llegaron)
            </button>
          )}
          {r.organizador.whatsapp && r.origen === 'sitio' && (
            <a
              className="panel-boton"
              href={enlaceWhatsApp(`Hola ${r.organizador.nombre}, este es el link de tu reserva en Reta Saca (${r.folio}): ${direccion(`/r/${r.tokenPrivado}`)}`, r.organizador.whatsapp)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
          <button type="button" className={'panel-boton peligro' + (abierto === 'cancelar' ? ' activo' : '')} onClick={() => alternar('cancelar')}>
            Cancelar
          </button>
        </div>
      )}

      {abierto === 'sentar' && <Sentar r={r} config={config} ocupado={ocupado} hacer={hacer} />}
      {abierto === 'cobrar' && <Cobrar r={r} ocupado={ocupado} hacer={hacer} />}
      {abierto === 'extender' && (
        <div className="fila-detalle">
          <span>Agregar tiempo (se cobra en el local):</span>
          {([30, 60] as Duracion[]).map((m) => (
            <button key={m} type="button" className="panel-boton" disabled={ocupado} onClick={() => hacer(() => servicio.extender(r.id, m))}>
              +{m} min
            </button>
          ))}
        </div>
      )}
      {abierto === 'cambiar' && <Cambiar r={r} ocupado={ocupado} hacer={hacer} />}
      {abierto === 'cancelar' && (
        <div className="fila-detalle">
          <span>Cancelación del negocio: se devuelve TODO lo pagado en línea. Avísale al organizador por WhatsApp.</span>
          <button type="button" className="panel-boton peligro" disabled={ocupado} onClick={() => hacer(() => servicio.cancelarComoNegocio(r.id))}>
            Sí, cancelar y devolver
          </button>
        </div>
      )}
      {error && <p className="panel-error">{error}</p>}
    </article>
  )
}

function Etiquetas({ r, config }: { r: Reserva; config: Configuracion }) {
  const e: [string, string][] = []
  if (r.estado === 'apartada') e.push(['aviso', 'Pagando…'])
  if (r.estado === 'cancelada') {
    const motivo = { cliente: 'Canceló el cliente', negocio: 'Cancelada por el negocio', no_llego: 'No llegaron', apartado_vencido: 'No pagó a tiempo' }
    e.push(['apagada', r.cancelacion ? motivo[r.cancelacion.motivo] : 'Cancelada'])
  }
  if (r.origen === 'mostrador') e.push(['neutra', 'Sin reserva'])
  if (r.llegaronEn && r.estado !== 'cancelada') e.push(['bien', r.mesa ? `En ${r.mesa}` : 'Llegaron'])
  else if (puedeLiberarPorRetraso(r, config, Date.now())) e.push(['mal', 'Retraso'])
  if (r.partesElegidas > 1) e.push(['neutra', `Entre ${r.partesElegidas}`])
  if (r.conPromo) e.push(['neutra', 'Promo'])
  return (
    <>
      {e.map(([tipo, texto]) => (
        <span key={texto} className={`etiqueta ${tipo}`}>
          {texto}
        </span>
      ))}
    </>
  )
}

type Hacer = (f: () => Promise<unknown>) => Promise<void>

function Sentar({ r, config, ocupado, hacer }: { r: Reserva; config: Configuracion; ocupado: boolean; hacer: Hacer }) {
  const d = config.deportes[r.deporte]
  const mesas = Array.from({ length: d.mesas }, (_, i) => i + 1).filter((n) => !d.fueraDeServicio.includes(n))
  const [mesa, setMesa] = useState(r.mesa ?? `${d.clave} ${mesas[0]}`)
  return (
    <div className="fila-detalle">
      <span>Mesa:</span>
      <select value={mesa} onChange={(e) => setMesa(e.target.value)}>
        {mesas.map((n) => (
          <option key={n}>{`${d.clave} ${n}`}</option>
        ))}
      </select>
      <button type="button" className="panel-boton primario" disabled={ocupado} onClick={() => hacer(() => servicio.asignarMesa(r.id, mesa))}>
        {r.mesa ? 'Cambiar mesa' : 'Sentar aquí'}
      </button>
      {r.mesa && (
        <button type="button" className="panel-boton" disabled={ocupado} onClick={() => hacer(() => servicio.asignarMesa(r.id, null))}>
          Quitar mesa
        </button>
      )}
    </div>
  )
}

function Cobrar({ r, ocupado, hacer }: { r: Reserva; ocupado: boolean; hacer: Hacer }) {
  const pendientes = partesPendientes(r)
  const [elegidas, setElegidas] = useState<string[]>(pendientes.map((p) => p.id))
  const [medio, setMedio] = useState<Exclude<MedioDePago, 'en_linea'>>('efectivo')
  const [nombre, setNombre] = useState('')
  const suma = pendientes.filter((p) => elegidas.includes(p.id)).reduce((s, p) => s + p.monto, 0)
  return (
    <div className="fila-detalle columna">
      <div className="fila-partes">
        {pendientes.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={elegidas.includes(p.id)}
              onChange={(e) => setElegidas(e.target.checked ? [...elegidas, p.id] : elegidas.filter((x) => x !== p.id))}
            />
            {formatoDinero(p.monto)} {p.concepto === 'extension' ? '(tiempo extra)' : p.concepto === 'cambio' ? '(diferencia)' : p.delOrganizador ? '(organizador)' : ''}
          </label>
        ))}
      </div>
      <div className="fila-detalle sin-borde">
        <select value={medio} onChange={(e) => setMedio(e.target.value as typeof medio)}>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
        </select>
        <input type="text" placeholder={`Quién paga (${r.organizador.nombre})`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button type="button" className="panel-boton primario" disabled={ocupado || !elegidas.length} onClick={() => hacer(() => servicio.marcarPago(r.id, elegidas, medio, nombre))}>
          Marcar pagado {formatoDinero(suma)}
        </button>
      </div>
    </div>
  )
}

function Cambiar({ r, ocupado, hacer }: { r: Reserva; ocupado: boolean; hacer: Hacer }) {
  const [fecha, setFecha] = useState(r.fecha)
  const [hora, setHora] = useState(horaDe24(r.inicio))
  return (
    <div className="fila-detalle">
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <input type="time" step={1800} value={hora} onChange={(e) => setHora(e.target.value)} />
      <button type="button" className="panel-boton primario" disabled={ocupado || !hora} onClick={() => hacer(() => servicio.cambiarHorario(r.id, fecha, minutosDe(hora)))}>
        Mover
      </button>
      <span className="nota">Misma duración. Si pierde la promo, la diferencia queda por cobrar.</span>
    </div>
  )
}
