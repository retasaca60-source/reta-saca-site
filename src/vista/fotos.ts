// La foto de cada juego (public/imagenes/deportes). Vive en la vista y no en la
// configuración del negocio: es parte del diseño, no algo que Hugo cambie desde
// el panel. `enfoque` es el encuadre vertical de cada foto en su tarjeta: a 35%
// la pelota, los costales y las plumas de los dardos quedan DEBAJO de la franja
// del nombre gigante (que termina hacia los 93 px), tanto a 390 px de ancho como
// en la columna de 460. Calculado con el tamaño de cada foto; con 80% la pelota
// se salía de la tarjeta y con 60% quedaba detrás de la palabra.

import type { DeporteId } from '../negocio/configuracion'

export const FOTO_DE: Record<DeporteId, { src: string; enfoque: string }> = {
  pingpong: { src: '/imagenes/deportes/pingpong.webp', enfoque: '50% 35%' },
  cornhole: { src: '/imagenes/deportes/cornhole.webp', enfoque: '50% 35%' },
  popdarts: { src: '/imagenes/deportes/popdarts.webp', enfoque: '60% 35%' },
}
