// La mesa de cada juego vista desde arriba, para el plano del panel. El estado
// se lee en el dibujo mismo: libre es el juego solo; en juego aparecen las
// cosas de los jugadores (paletas y pelota, costales, dardos clavados). Así
// recepción ve de un vistazo qué está ocupado sin leer texto.

import type { DeporteId } from '../negocio/configuracion'

export function DibujoMesa({ deporte, enJuego }: { deporte: DeporteId; enJuego: boolean }) {
  return (
    <svg className="dibujo-mesa" viewBox="0 0 200 116" aria-hidden>
      {deporte === 'pingpong' && <PingPong enJuego={enJuego} />}
      {deporte === 'cornhole' && <Cornhole enJuego={enJuego} />}
      {deporte === 'popdarts' && <Popdarts enJuego={enJuego} />}
    </svg>
  )
}

function PingPong({ enJuego }: { enJuego: boolean }) {
  return (
    <g>
      {/* Sombra en el piso y la mesa azul con sus líneas blancas. */}
      <rect x="28" y="20" width="144" height="80" rx="4" fill="#0f2f63" opacity=".18" transform="translate(3 4)" />
      <rect x="28" y="20" width="144" height="80" rx="4" fill="#1f5fbf" />
      <rect x="31" y="23" width="138" height="74" rx="2" fill="none" stroke="#fff" strokeWidth="2.5" />
      <line x1="31" y1="60" x2="169" y2="60" stroke="#fff" strokeWidth="1.5" />
      {/* La red, con sus postes asomando por los lados. */}
      <rect x="98" y="14" width="4" height="92" rx="2" fill="#e9edf3" />
      <rect x="98.8" y="14" width="2.4" height="92" fill="#262a31" opacity=".55" />
      <circle cx="100" cy="14" r="3" fill="#262a31" />
      <circle cx="100" cy="106" r="3" fill="#262a31" />
      {enJuego && (
        <g>
          {/* Una paleta en cada cabecera y la pelota en el aire. */}
          <g transform="translate(14 46) rotate(-20)">
            <rect x="-2" y="10" width="5" height="12" rx="2" fill="#7a4a24" />
            <circle cx="0.5" cy="4" r="10" fill="#d92d20" />
          </g>
          <g transform="translate(186 74) rotate(160)">
            <rect x="-2" y="10" width="5" height="12" rx="2" fill="#7a4a24" />
            <circle cx="0.5" cy="4" r="10" fill="#262a31" />
          </g>
          <circle cx="132" cy="44" r="4.5" fill="#fff" stroke="#f0a500" strokeWidth="1.5" />
        </g>
      )}
    </g>
  )
}

function Tablero({ x, hoyo }: { x: number; hoyo: number }) {
  return (
    <g>
      <rect x={x + 2} y="34" width="62" height="48" rx="4" fill="#5a3a1c" opacity=".18" transform="translate(2 3)" />
      <rect x={x} y="34" width="62" height="48" rx="4" fill="#e0a868" />
      <rect x={x + 3} y="37" width="56" height="42" rx="2" fill="none" stroke="#b97a3e" strokeWidth="2" />
      {/* Vetas de la madera. */}
      <path d={`M${x + 8} 48h46M${x + 8} 58h46M${x + 8} 68h46`} stroke="#c98f52" strokeWidth="1" opacity=".6" />
      <circle cx={hoyo} cy="58" r="9" fill="#2b1a0c" />
      <circle cx={hoyo} cy="58" r="9" fill="none" stroke="#9c6430" strokeWidth="2" />
    </g>
  )
}

function Cornhole({ enJuego }: { enJuego: boolean }) {
  return (
    <g>
      {/* Los dos tableros frente a frente, cada hoyo en su extremo lejano. */}
      <line x1="76" y1="58" x2="124" y2="58" stroke="#c9ced6" strokeWidth="2" strokeDasharray="4 5" />
      <Tablero x={12} hoyo={30} />
      <Tablero x={126} hoyo={170} />
      {enJuego && (
        <g>
          {/* Costales: rojos de un equipo, azules del otro. */}
          <rect x="42" y="40" width="13" height="13" rx="3" fill="#d92d20" transform="rotate(14 48 46)" />
          <rect x="54" y="62" width="13" height="13" rx="3" fill="#1f5fbf" transform="rotate(-10 60 68)" />
          <rect x="140" y="62" width="13" height="13" rx="3" fill="#d92d20" transform="rotate(-18 146 68)" />
          <rect x="100" y="70" width="13" height="13" rx="3" fill="#1f5fbf" transform="rotate(22 106 76)" />
        </g>
      )}
    </g>
  )
}

function Popdarts({ enJuego }: { enJuego: boolean }) {
  return (
    <g>
      {/* La diana de anillos sobre su base. */}
      <ellipse cx="103" cy="62" rx="48" ry="48" fill="#262a31" opacity=".12" />
      <circle cx="100" cy="58" r="48" fill="#fff" stroke="#262a31" strokeWidth="3" />
      <circle cx="100" cy="58" r="38" fill="#1f5fbf" />
      <circle cx="100" cy="58" r="28" fill="#fff" />
      <circle cx="100" cy="58" r="18" fill="#d92d20" />
      <circle cx="100" cy="58" r="8" fill="#ffc53d" />
      {enJuego && (
        <g>
          {/* Dos dardos clavados, inclinados hacia afuera como quedan al
              lanzarlos: uno de cada equipo. */}
          <Dardo x={90} y={52} angulo={45} color="#0e8f6e" claro="#6fd3b3" />
          <Dardo x={113} y={66} angulo={135} color="#262a31" claro="#9aa1ac" />
        </g>
      )}
    </g>
  )
}

/**
 * Un dardo de ventosa visto de tres cuartos. Se dibuja con la punta en (0,0) y
 * la cola hacia -x; `angulo` lo gira para que la cola apunte hacia afuera.
 */
function Dardo({ x, y, angulo, color, claro }: { x: number; y: number; angulo: number; color: string; claro: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angulo}) scale(1.35)`}>
      {/* Sombra donde se pegó. */}
      <ellipse cx="1" cy="2.5" rx="5" ry="2.5" fill="#000" opacity=".22" />
      {/* Aletas en V y su lomo. */}
      <path d="M-24 0 L-35 -8.5 L-31 -1.2 Z" fill={claro} stroke={color} strokeWidth=".9" strokeLinejoin="round" />
      <path d="M-24 0 L-35 8.5 L-31 1.2 Z" fill={color} stroke={color} strokeWidth=".9" strokeLinejoin="round" />
      {/* Varilla y cuerpo. */}
      <rect x="-27" y="-1" width="15" height="2" rx="1" fill="#3a3f48" />
      <rect x="-14" y="-2.4" width="11" height="4.8" rx="2.4" fill={color} />
      <rect x="-12.5" y="-1.6" width="8" height="1.2" rx=".6" fill="#fff" opacity=".35" />
      {/* La ventosa naranja, pegada a la diana. */}
      <ellipse cx="-1.5" cy="0" rx="2.6" ry="3.6" fill="#ff8a1e" stroke="#c45f00" strokeWidth=".7" />
    </g>
  )
}
