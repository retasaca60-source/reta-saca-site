// La barra de arriba del sitio: logo y nombre, y el aviso de demostración
// mientras los datos sean simulados.

import { Link, useLocation } from 'react-router-dom'
import { servicio } from '../datos'

export function Cabecera() {
  // En "/" el pase ya lleva la marca arriba; en las demás páginas la barra sirve para volver al inicio.
  const enReservar = useLocation().pathname === '/'
  return (
    <>
      <div className="barra-app" hidden={enReservar}>
        <Link to="/" aria-label="Reta Saca, inicio">
          <img src="/imagenes/logo.png" alt="" />
          <strong>Reta Saca</strong>
        </Link>
      </div>
      {/* Desaparece solo cuando los datos son los reales (datos/index.ts). */}
      {servicio.modo === 'simulado' && (
        <p className="aviso-demo">Modo demostración: las reservas se guardan solo en este navegador y el pago es simulado. No se cobra nada.</p>
      )}
    </>
  )
}
