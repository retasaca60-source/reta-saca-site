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
          {/* Paleta con el mango corto y ancho hacia abajo, y la pelota al lado. El
              mango en diagonal y delgado se leía como la lupa de "buscar". */}
          <circle cx="10" cy="9" r="6" />
          <rect x="8.5" y="15" width="3" height="6" rx="1.2" />
          <circle cx="19" cy="15" r="1.6" fill="currentColor" />
        </>
      )}
      {icono === 'costal' && (
        <>
          {/* Tablero en perspectiva con el hoyo arriba, y el costal fuera del
              tablero. Con el costal adentro parecía una bocina. */}
          <path d="M6 4h7l3 15H3L6 4z" />
          <circle cx="9.5" cy="8" r="1.8" />
          <rect x="17" y="15" width="5" height="5" rx="1.2" />
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
