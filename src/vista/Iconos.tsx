// Íconos dibujados que usa más de una pantalla. Todos con el mismo trazo (2) y
// el color del texto, igual que los de cada deporte.

export function IconoAtras() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

/** Las flechas del deslizador: tres galones que se desvanecen hacia la izquierda. */
export function IconoFlechas() {
  return (
    <svg width="34" height="16" viewBox="0 0 34 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l5 5-5 5" opacity="0.35" />
      <path d="M13 3l5 5-5 5" opacity="0.65" />
      <path d="M23 3l5 5-5 5" />
    </svg>
  )
}
