// Cambiar entre la lista de juegos y la ficha de uno: la foto de la tarjeta
// crece hasta ser la portada (y regresa al volver). Usa las transiciones de
// vista del navegador; donde no existen, o si la persona pidió menos
// movimiento, el cambio es inmediato. Las dos fotos se enlazan por su
// `view-transition-name` (reservar.css).

import { flushSync } from 'react-dom'

type ConTransiciones = Document & { startViewTransition?: (cambio: () => void) => unknown }

export function cambiarDePantalla(cambio: () => void) {
  const aplicar = () => {
    flushSync(cambio)
    // Cada pantalla empieza arriba: la ficha abre con su foto y la lista con el título.
    window.scrollTo(0, 0)
  }
  const doc = document as ConTransiciones
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) aplicar()
  else doc.startViewTransition(aplicar)
}
