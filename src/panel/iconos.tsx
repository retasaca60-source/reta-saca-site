// Íconos de línea del panel, dibujados aquí para no cargar una librería por
// seis figuras. Heredan el color del texto (currentColor).

type Props = { className?: string }
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/** Hoy: las mesas vistas desde arriba. */
export const IconoMesas = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="6" y="7" width="12" height="10" rx="2" />
    <path d="M3 10v4M21 10v4M10 4h4M10 20h4" />
  </svg>
)

export const IconoSemana = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />
  </svg>
)

export const IconoCaja = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="11" width="18" height="9" rx="2" />
    <path d="M6 11V6.5A1.5 1.5 0 0 1 7.5 5h9A1.5 1.5 0 0 1 18 6.5V11M9 8h6M7 15h2M11 15h2M15 15h2" />
  </svg>
)

export const IconoAjustes = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
  </svg>
)

export const IconoSalir = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 16l-4-4 4-4M6 12h10" />
  </svg>
)

export const IconoAnterior = (p: Props) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const IconoSiguiente = (p: Props) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)
