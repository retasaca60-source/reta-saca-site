// Cuando publicamos una versión nueva, los archivos de cada pantalla cambian de
// nombre (Reservar-abc.js pasa a Reservar-xyz.js). Quien tenía la página
// abierta desde antes sigue con la lista vieja: al tocar un juego pide un
// archivo que ya no existe y la pantalla se queda trabada. Lo mismo pasa si la
// señal se corta justo al pedirlo (Sentry lo registró el 26/10 con
// Reservar-Dxk6epA8.css, que sí existía).
//
// Vite avisa de eso con el evento `vite:preloadError`. Aquí se recarga la
// página UNA vez: trae la lista nueva y el cliente sigue donde iba (el
// borrador de la reserva se guarda en el navegador).
//
// Decisiones:
// - **Una sola vez por minuto.** Se apunta en sessionStorage cuándo se
//   recargó. Si vuelve a fallar enseguida, el problema no es de versión: se
//   deja pasar el error para que Sentry lo reciba, en vez de recargar sin fin.
// - **Sin sessionStorage no se recarga.** Si no se puede apuntar (modo privado
//   estricto), no hay forma de evitar el bucle: mejor el error que una página
//   que se recarga sola para siempre.

const LLAVE = 'reta-saca:recarga-por-archivo'
const ESPERA_MS = 60_000

interface Almacen {
  leer(): string | null
  escribir(valor: string): void
}

/** Lo que hace la página cuando falta un archivo. Devuelve true si recargó. */
export function crearRecarga(almacen: Almacen, ahora: () => number, recargar: () => void) {
  return (evento: Pick<Event, 'preventDefault'>): boolean => {
    let anterior = 0
    try {
      anterior = Number(almacen.leer()) || 0
    } catch {
      return false
    }
    if (ahora() - anterior < ESPERA_MS) return false
    try {
      almacen.escribir(String(ahora()))
    } catch {
      return false
    }
    // Sin esto, Vite vuelve a lanzar el error aunque la página ya se esté recargando.
    evento.preventDefault()
    recargar()
    return true
  }
}

export function recargarSiFaltaUnArchivo(): void {
  const alFallar = crearRecarga(
    {
      leer: () => sessionStorage.getItem(LLAVE),
      escribir: (valor) => sessionStorage.setItem(LLAVE, valor),
    },
    () => Date.now(),
    () => window.location.reload(),
  )
  window.addEventListener('vite:preloadError', alFallar)
}
