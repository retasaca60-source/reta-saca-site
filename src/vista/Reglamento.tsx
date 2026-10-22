// Las reglas del juego y las políticas, como en los carteles del local: el
// número en el color de la casa, el título fuerte y el texto debajo. Se
// muestran al terminar de reservar (la reserva confirmada) y en /politicas.

import type { DeporteId } from '../negocio/configuracion'
import { POLITICAS, REGLAS_DEL_JUEGO, type Regla } from './reglasYPoliticas'
import './reglamento.css'

function Lista({ reglas }: { reglas: Regla[] }) {
  return (
    <ol className="grupo reglamento">
      {reglas.map((r, i) => (
        <li key={r.titulo}>
          <span className="reglamento-numero numeros" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span>
            <strong>{r.titulo}</strong>
            <span className="reglamento-texto">{r.texto}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function ReglasDelJuego({ deporte, nombre }: { deporte: DeporteId; nombre: string }) {
  return (
    <section aria-labelledby={`reglas-${deporte}`}>
      <h2 className="titulo-seccion" id={`reglas-${deporte}`}>
        Reglas de {nombre}
      </h2>
      <Lista reglas={REGLAS_DEL_JUEGO[deporte]} />
    </section>
  )
}

/**
 * Las 32 políticas. Al terminar de reservar van plegadas: son largas y lo
 * primero que busca quien acaba de pagar es su ticket y las reglas del juego.
 */
export function Politicas({ plegadas = false }: { plegadas?: boolean }) {
  if (!plegadas) {
    return (
      <section aria-labelledby="politicas">
        <h2 className="titulo-seccion" id="politicas">
          Políticas de Reta Saca
        </h2>
        <Lista reglas={POLITICAS} />
      </section>
    )
  }
  return (
    <details className="reglamento-plegado">
      <summary className="titulo-seccion">Políticas de Reta Saca</summary>
      <Lista reglas={POLITICAS} />
    </details>
  )
}
