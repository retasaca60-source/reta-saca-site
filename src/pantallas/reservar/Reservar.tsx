// La página principal: armar una reserva en tres pasos y mandar a pagar.

import { useReducer } from 'react'
import { servicio } from '../../datos'
import { usarDatos } from '../../mecanismos/datos/usarDatos'
import { borradorNuevo, reducir } from '../../mecanismos/reserva/estado'
import { ahoraEnSonora } from '../../negocio/tiempo'
import { Progreso } from '../../vista/Progreso'
import { PasoDatos } from './PasoDatos'
import { PasoDeporte } from './PasoDeporte'
import { PasoHorario } from './PasoHorario'

export default function Reservar() {
  const { datos: config, error } = usarDatos(() => servicio.configuracion(), [])
  const [borrador, despachar] = useReducer(reducir, ahoraEnSonora().fecha, borradorNuevo)

  if (error) return <div className="card"><p className="section-hint">{error}</p></div>
  if (!config) return <div className="card cargando" aria-busy="true">Cargando…</div>

  const props = { borrador, despachar, config }
  return (
    <>
      <Progreso paso={borrador.paso} />
      {/* key: la animación de entrada corre al cambiar de paso, no con cada toque. */}
      <div id="screens" key={borrador.paso}>
        {borrador.paso === 1 && <PasoDeporte {...props} />}
        {borrador.paso === 2 && <PasoHorario {...props} />}
        {borrador.paso === 3 && <PasoDatos {...props} />}
      </div>
    </>
  )
}
