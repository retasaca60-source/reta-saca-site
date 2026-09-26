// La barra de tres tramos: Deporte · Horario · Datos.

import type { Paso } from '../mecanismos/reserva/estado'
import './progreso.css'

const TRAMOS = ['Deporte', 'Horario', 'Datos'] as const

export function Progreso({ paso }: { paso: Paso }) {
  // La reserva lista (paso 4) se sigue mostrando en el tercer tramo.
  const actual = Math.min(paso, 3)
  return (
    <div className="progress">
      <div className="progress-track">
        {TRAMOS.map((_, i) => {
          const n = i + 1
          const estado = n < actual ? ' done' : n === actual ? ' active' : ''
          return (
            <div key={n} className={'progress-seg' + estado}>
              <i />
            </div>
          )
        })}
      </div>
      <div className="progress-labels">
        {TRAMOS.map((nombre, i) => (
          <span key={nombre} className={i + 1 === actual ? 'current' : ''}>
            0{i + 1} {nombre}
          </span>
        ))}
      </div>
    </div>
  )
}
