// La barra de arriba de las páginas secundarias (mi reserva, cobro, pago,
// privacidad): logo para volver al inicio. En "/" no se pinta: la lista de
// juegos lleva su propia marca y la ficha abre con la foto hasta arriba.

import { Link, useLocation } from 'react-router-dom'

export function Cabecera() {
  const enReservar = useLocation().pathname === '/'
  if (enReservar) return null
  return (
    <div className="barra-app">
      <Link to="/" aria-label="Reta Saca, inicio">
        <img src="/imagenes/logo.png" alt="" />
        <strong>Reta Saca</strong>
      </Link>
    </div>
  )
}
