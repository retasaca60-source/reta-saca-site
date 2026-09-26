// El logo arriba y el aviso de que es una demostración.

import './cabecera.css'

export function Cabecera() {
  return (
    <>
      <div className="masthead">
        <img className="logo" src="/imagenes/logo.png" alt="Reta Saca" />
        <div className="tagline">
          PING PONG<span className="dot">&bull;</span>CORNHOLE<span className="dot">&bull;</span>POPDARTS
        </div>
      </div>

      {/* Se quita cuando las reservas se guarden de verdad (ver negocio/disponibilidad.ts). */}
      <div className="demo-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <span>Modo demostración — disponibilidad de ejemplo. Ninguna reserva se guarda de verdad.</span>
      </div>
    </>
  )
}
