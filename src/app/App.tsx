// Qué pantalla se ve según el paso de la reserva.

import { useReducer } from 'react'
import { reducir, reservaNueva } from '../mecanismos/reserva/estado'
import { PasoDatos } from '../pantallas/datos/PasoDatos'
import { PasoDeporte } from '../pantallas/deporte/PasoDeporte'
import { PasoHorario } from '../pantallas/horario/PasoHorario'
import { ReservaLista } from '../pantallas/reserva-lista/ReservaLista'
import { Cabecera } from '../vista/Cabecera'
import { Progreso } from '../vista/Progreso'

const PANTALLAS = {
  1: PasoDeporte,
  2: PasoHorario,
  3: PasoDatos,
  4: ReservaLista,
} as const

export default function App() {
  const [reserva, despachar] = useReducer(reducir, reservaNueva)
  const Pantalla = PANTALLAS[reserva.paso]

  return (
    <>
      <Cabecera />
      <Progreso paso={reserva.paso} />
      {/* key: la animación de entrada corre al cambiar de paso, no con cada toque dentro del mismo paso. */}
      <div id="screens">
        <Pantalla key={reserva.paso} reserva={reserva} despachar={despachar} />
      </div>
    </>
  )
}
