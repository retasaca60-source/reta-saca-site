// El logo arriba y el aviso de que es una demostración.

import { Link } from 'react-router-dom'
import { servicio } from '../datos'
import './cabecera.css'

export function Cabecera() {
  return (
    <>
      <div className="masthead">
        <Link to="/" aria-label="Reta Saca, inicio">
          <img className="logo" src="/imagenes/logo.png" alt="Reta Saca" />
        </Link>
        <div className="tagline">
          PING PONG<span className="dot">&bull;</span>CORNHOLE<span className="dot">&bull;</span>POPDARTS
        </div>
      </div>

      {/* Desaparece solo cuando los datos son los reales (datos/index.ts). */}
      {servicio.modo === 'simulado' && (
      <div className="demo-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <span>Modo demostración: las reservas se guardan solo en este navegador y el pago es simulado. No se cobra nada.</span>
      </div>
      )}
    </>
  )
}
