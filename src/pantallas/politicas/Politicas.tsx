// Las políticas de Reta Saca y las reglas de cada juego. Se enlaza desde la
// casilla "Acepto…" antes de pagar; se abre en otra pestaña para no perder lo
// que ya se capturó en la reserva.

import { Link } from 'react-router-dom'
import { ORDEN_DEPORTES } from '../../negocio/configuracion'
import { Politicas as ListaDePoliticas, ReglasDelJuego } from '../../vista/Reglamento'

const NOMBRE = { pingpong: 'Ping Pong', cornhole: 'Cornhole' } as const

export default function Politicas() {
  return (
    <>
      <h1 className="titulo-grande" style={{ marginTop: 20 }}>
        Políticas y reglas
      </h1>
      <ListaDePoliticas />
      {ORDEN_DEPORTES.map((id) => (
        <ReglasDelJuego key={id} deporte={id} nombre={NOMBRE[id]} />
      ))}
      <Link className="enlace-discreto" to="/">
        Volver a reservar
      </Link>
    </>
  )
}
