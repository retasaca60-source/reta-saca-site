// La caja del mostrador: registrar a un grupo que llega sin reserva y
// cobrarle en el mismo paso (RESERVAS.md §10). Deporte, tiempo y mesa → se ve
// el total → cómo paga → cobrado y sentado. El comprobante es el ticket de la
// terminal; con efectivo, la caja calcula el cambio.

import { useState } from 'react'
import { servicio } from '../datos'
import { mensajeDeError, usarDatos } from '../mecanismos/datos/usarDatos'
import { ORDEN_DEPORTES, type Configuracion, type DeporteId, type Duracion } from '../negocio/configuracion'
import { formatoDinero } from '../negocio/formato'
import { bloqueEn, estaCerrado } from '../negocio/horario'
import { fin, ocupaMesa, total, type MedioDePago, type Reserva } from '../negocio/reserva'
import { ahoraEnSonora, diaDeLaSemana, formatoHora } from '../negocio/tiempo'

type Medio = Exclude<MedioDePago, 'en_linea'>
const MEDIOS: { medio: Medio; nombre: string }[] = [
  { medio: 'efectivo', nombre: 'Efectivo' },
  { medio: 'tarjeta', nombre: 'Tarjeta' },
]

export function RegistrarEnMostrador({
  config,
  reservas,
  inicial,
}: {
  config: Configuracion
  reservas: Reserva[]
  /** Desde una mesa libre del plano: la caja abre con ese deporte y esa mesa. */
  inicial?: { deporte: DeporteId; mesa: string }
}) {
  const [deporte, setDeporte] = useState<DeporteId>(inicial?.deporte ?? 'pingpong')
  const [duracion, setDuracion] = useState<Duracion>(60)
  const [mesa, setMesa] = useState(inicial?.mesa ?? '')
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [medio, setMedio] = useState<Medio>('efectivo')
  const [pagaCon, setPagaCon] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const d = config.deportes[deporte]
  const ahora = ahoraEnSonora()
  // El total lo da el servidor con SU hora y SU tarifa: antes se calculaba
  // aquí con el reloj de la laptop, y si iba desfasado (o terminaba la promo)
  // la pantalla decía un precio y se guardaba otro.
  const cotizacion = usarDatos(() => servicio.cotizarSinReserva(deporte, duracion), [deporte, duracion])
  const precio = cotizacion.datos?.precio
  const conPromo = cotizacion.datos?.conPromo ?? false
  const termina = (cotizacion.datos?.inicio ?? ahora.minutos) + duracion
  // Mesas que se ven libres en todo el tiempo que van a jugar. La revisión
  // que vale la hace la operación al cobrar; esto es para elegir rápido.
  const ocupadas = reservas
    .filter((r) => r.deporte === deporte && r.mesa && ocupaMesa(r, ahora.ms) && r.inicio < termina && fin(r) > ahora.minutos)
    .map((r) => r.mesa)
  const libres = Array.from({ length: d.mesas }, (_, i) => `${d.clave} ${i + 1}`).filter(
    (m, i) => !d.fueraDeServicio.includes(i + 1) && !ocupadas.includes(m),
  )
  const recibido = Number(pagaCon) || 0
  const cambio = recibido - (precio ?? 0)
  // Mismas razones que da la operación, pero antes de intentar cobrar.
  const bloque = bloqueEn(config, ahora.fecha, ahora.minutos)
  // Si está cerrado, se dice cuándo abre: antes solo decía "cerrado" en letra
  // chica lejos del botón, y el botón gris parecía descompuesto.
  const abreHoy = estaCerrado(config, ahora.fecha)
    ? undefined
    : (config.horario[diaDeLaSemana(ahora.fecha)] ?? []).find((b) => b.desde > ahora.minutos)
  const impedimento = !bloque
    ? abreHoy
      ? `El local está cerrado: abre a las ${formatoHora(abreHoy.desde)}. La caja cobra solo en horario.`
      : 'El local ya cerró por hoy. La caja cobra solo en horario.'
    : termina > bloque.hasta
      ? `No alcanza: se cierra a las ${formatoHora(bloque.hasta)}. Elige menos tiempo.`
      : null
  const listo = precio !== undefined && !impedimento && nombre.trim().length > 1 && !ocupado && (medio !== 'efectivo' || !pagaCon || cambio >= 0)

  const elegirDeporte = (nuevo: DeporteId) => {
    setDeporte(nuevo)
    setMesa('')
    if (!config.deportes[nuevo].duraciones.includes(duracion)) setDuracion(config.deportes[nuevo].duraciones[0])
  }

  const cobrar = async () => {
    if (precio === undefined) return
    setOcupado(true)
    setError(null)
    setHecho(null)
    try {
      // Con el precio que se vio: si el servidor calcula otro, no registra nada.
      const r = await servicio.anotarSinReserva({ deporte, duracion, nombre, whatsapp, mesa: mesa || undefined, medio, precioEsperado: precio })
      // Lo que se muestra sale de lo GUARDADO, no de lo que se calculó antes.
      const cobrado = total(r)
      setHecho(
        `${r.organizador.nombre}: ${d.nombre} ${formatoDinero(cobrado)} cobrado en ${medio}` +
          (r.mesa ? `, sentados en ${r.mesa}` : ', falta sentarlos') +
          ` hasta las ${formatoHora(fin(r))}.` +
          (medio === 'efectivo' && recibido > cobrado ? ` Cambio: ${formatoDinero(recibido - cobrado)}.` : ''),
      )
      setNombre('')
      setWhatsapp('')
      setMesa('')
      setPagaCon('')
    } catch (e) {
      setError(mensajeDeError(e))
      // Si el precio cambió, que la pantalla traiga el nuevo antes de reintentar.
      cotizacion.recargar()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="panel-tarjeta caja-mostrador">
      <h3>Caja · cliente en el local</h3>

      <div className="caja-fila">
        <div className="segmentado" role="group" aria-label="Deporte">
          {ORDEN_DEPORTES.map((id) => (
            <button key={id} type="button" className={deporte === id ? 'activo' : ''} aria-pressed={deporte === id} onClick={() => elegirDeporte(id)}>
              {config.deportes[id].nombre}
            </button>
          ))}
        </div>
        <div className="segmentado" role="group" aria-label="Tiempo">
          {d.duraciones.map((m) => (
            <button key={m} type="button" className={duracion === m ? 'activo' : ''} aria-pressed={duracion === m} onClick={() => setDuracion(m)}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div className="caja-fila">
        <label>
          Mesa
          <select value={mesa} onChange={(e) => setMesa(e.target.value)}>
            <option value="">Sentar después</option>
            {libres.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Nombre
          <input type="text" placeholder="Para identificar al grupo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label>
          WhatsApp
          <input type="tel" placeholder="Opcional" maxLength={10} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>

      <div className="caja-fila caja-cobro">
        <div className="caja-total-grande">
          <small>
            Total{conPromo && ' · promo'} · hasta las {formatoHora(termina)}
          </small>
          <strong>{precio === undefined ? '…' : formatoDinero(precio)}</strong>
          {cotizacion.error && <small className="panel-error">{cotizacion.error}</small>}
        </div>
        <div className="segmentado" role="group" aria-label="Cómo paga">
          {MEDIOS.map((x) => (
            <button key={x.medio} type="button" className={medio === x.medio ? 'activo' : ''} aria-pressed={medio === x.medio} onClick={() => setMedio(x.medio)}>
              {x.nombre}
            </button>
          ))}
        </div>
        {medio === 'efectivo' && (
          <label className="caja-efectivo">
            Paga con
            <input type="number" min={0} inputMode="numeric" placeholder={precio === undefined ? '' : String(precio)} value={pagaCon} onChange={(e) => setPagaCon(e.target.value)} />
            {pagaCon && <span className={cambio < 0 ? 'panel-error' : 'nota bien'}>{cambio < 0 ? `Faltan ${formatoDinero(-cambio)}` : `Cambio ${formatoDinero(cambio)}`}</span>}
          </label>
        )}
        <div className="caja-cobrar">
          {impedimento && <p className="panel-error">{impedimento}</p>}
          <button type="button" className="panel-boton primario grande" disabled={!listo} onClick={cobrar}>
            {ocupado ? 'Cobrando…' : precio === undefined ? 'Calculando total…' : `Cobrar ${formatoDinero(precio)} y registrar`}
          </button>
        </div>
      </div>

      {hecho && <p className="nota bien">{hecho}</p>}
      {error && <p className="panel-error">{error}</p>}
    </div>
  )
}
