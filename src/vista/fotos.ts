// La foto de cada juego (public/imagenes/deportes). Vive en la vista y no en la
// configuración del negocio: es parte del diseño, no algo que Hugo cambie desde
// el panel. `enfoque` es el punto de la foto que no se debe recortar: las
// tarjetas y la portada la cortan a lo ancho y cada foto tiene su objeto en otro
// lugar (la pelota al centro, los costales arriba, los dardos abajo a la derecha).

import type { DeporteId } from '../negocio/configuracion'

export const FOTO_DE: Record<DeporteId, { src: string; enfoque: string }> = {
  pingpong: { src: '/imagenes/deportes/pingpong.webp', enfoque: '50% 62%' },
  cornhole: { src: '/imagenes/deportes/cornhole.webp', enfoque: '50% 42%' },
  popdarts: { src: '/imagenes/deportes/popdarts.webp', enfoque: '60% 58%' },
}

/**
 * La foto del centro del pase (mi reserva y link de cobro), en el lugar donde
 * el boleto de avión de la referencia lleva el avión. Ping Pong tiene una toma
 * hecha para eso (paleta y pelota de frente); los otros dos usan su foto de
 * tarjeta, encuadrada en su objeto.
 */
export const FOTO_PASE: Record<DeporteId, { src: string; enfoque: string }> = {
  pingpong: { src: '/imagenes/deportes/pingpong-pase.webp', enfoque: '50% 66%' },
  cornhole: { src: '/imagenes/deportes/cornhole.webp', enfoque: '50% 45%' },
  popdarts: { src: '/imagenes/deportes/popdarts.webp', enfoque: '60% 60%' },
}
