// El ícono de cada deporte, dibujado en un solo sistema: el mismo trazo (2) y
// el color del texto (`currentColor`) que el resto de los íconos del sitio.
// Antes Ping Pong y Cornhole eran imágenes y Popdarts un dibujo: dos estilos
// juntos en la misma lista.

import type { Configuracion, DeporteId } from '../negocio/configuracion'

export function IconoDeporte({ id, config }: { id: DeporteId; config: Configuracion }) {
  const icono = config.deportes[id].icono
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icono === 'paleta' && (
        <>
          {/* Paleta con su mango y la pelota. */}
          <circle cx="10" cy="10" r="6" />
          <path d="M14.2 14.2l4.3 4.3" />
          <circle cx="19" cy="5" r="1.4" fill="currentColor" />
        </>
      )}
      {icono === 'costal' && (
        <>
          {/* Tablero de cornhole con su hoyo, y un costal. */}
          <path d="M8 3h8l3 18H5L8 3z" />
          <circle cx="12" cy="8" r="2" />
          <rect x="9" y="14" width="6" height="4" rx="1" />
        </>
      )}
      {icono === 'diana' && (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r=".8" fill="currentColor" />
        </>
      )}
    </svg>
  )
}
