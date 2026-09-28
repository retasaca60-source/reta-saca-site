// La página principal: el pase arriba se va llenando mientras el cliente
// elige en tres pasos (deporte y cómo pagan → horario → datos) y manda a pagar.

import { useReducer } from 'react'
import { servicio } from '../../datos'
import { usarDatos } from '../../mecanismos/datos/usarDatos'
import { borradorNuevo, reducir, type Borrador } from '../../mecanismos/reserva/estado'
import type { Configuracion, Duracion } from '../../negocio/configuracion'
import { precioDe } from '../../negocio/precios'
import { repartir } from '../../negocio/reserva'
import { ahoraEnSonora, formatoDuracion, formatoHora, nombreDelDia } from '../../negocio/tiempo'
import { Pase, type DatosDelPase } from '../../vista/Pase'
import { PasoDatos } from './PasoDatos'
import { PasoDeporte } from './PasoDeporte'
import { PasoHorario } from './PasoHorario'
import './reservar.css'

export default function Reservar() {
  const { datos: config, error } = usarDatos(() => servicio.configuracion(), [])
  const [borrador, despachar] = useReducer(reducir, ahoraEnSonora().fecha, borradorNuevo)

  if (error) return <p className="aviso aviso-error">{error}</p>
  if (!config) return <p className="cargando">Cargando…</p>

  const props = { borrador, despachar, config }
  return (
    <>
      <Pase datos={datosDelPase(borrador, config)} />
      {borrador.paso === 1 && <PasoDeporte {...props} />}
      {borrador.paso === 2 && <PasoHorario {...props} />}
      {borrador.paso === 3 && <PasoDatos {...props} />}
    </>
  )
}

const FORMAS = { 1: 'Uno paga todo', 2: 'Entre 2', 4: 'Entre 4' } as const

/** Lo que el pase muestra en cada momento del borrador. El precio que vale lo calcula el servicio al apartar. */
function datosDelPase(b: Borrador, config: Configuracion): DatosDelPase {
  const d = b.deporte ? config.deportes[b.deporte] : null
  const datos: DatosDelPase = {
    deporte: d?.nombre,
    pagan: b.partes ? FORMAS[b.partes] : undefined,
    estado: `Paso ${b.paso} de 3`,
  }
  if (b.paso >= 2) {
    datos.dia = nombreDelDia(b.fecha)
    datos.duracion = formatoDuracion(b.duracion)
  }
  if (b.deporte && b.partes && b.inicio !== null) {
    const { precio } = precioDe(config, b.deporte, b.inicio, b.duracion as Duracion)
    datos.hora = formatoHora(b.inicio)
    datos.total = precio
    datos.tuParte = repartir(precio, b.partes)[0]
  }
  return datos
}
