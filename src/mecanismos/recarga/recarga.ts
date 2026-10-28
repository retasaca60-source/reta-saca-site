// Cuando publicamos una versión nueva, los archivos de cada pantalla cambian de
// nombre (Reservar-abc.js pasa a Reservar-xyz.js). Quien tenía la página
// abierta desde antes sigue con la lista vieja: al tocar un juego pide un
// archivo que ya no existe y la pantalla se queda trabada. Lo mismo pasa si la
// señal se corta justo al pedirlo (Sentry lo registró el 26/10 con
// Reservar-Dxk6epA8.css, que sí existía).
//
// Cada pantalla se carga con `conRecarga`: si su archivo no llega, la página
// se recarga UNA vez, trae la lista nueva y el cliente sigue donde iba (el
// borrador de la reserva se guarda en el navegador).
//
// Decisiones:
// - **Se envuelve la carga, no el aviso `vite:preloadError`.** La primera
//   versión (27/10) escuchaba ese aviso y le hacía preventDefault: Vite
//   entonces resolvía la carga con `undefined`, React leía `.default` de nada y
//   mandaba a Sentry un "Cannot read properties of undefined" justo antes de
//   recargar. Envolviendo la carga, mientras la página se recarga la pantalla
//   se queda en "cargando" y no truena nada.
// - **Una sola vez por minuto.** Se apunta en sessionStorage cuándo se
//   recargó. Si vuelve a fallar enseguida, el problema no es de versión: el
//   error sigue su camino a la pantalla "Algo no cargó bien" y a Sentry, en
//   vez de una página que se recarga sin fin.
// - **Sin sessionStorage no se recarga**, por la misma razón: sin poder
//   apuntarlo no hay forma de evitar el bucle.

const LLAVE = 'reta-saca:recarga-por-archivo'
const ESPERA_MS = 60_000

interface Almacen {
  leer(): string | null
  escribir(valor: string): void
}

/** Recarga si no se recargó hace menos de un minuto. Devuelve true si recargó. */
export function crearRecarga(almacen: Almacen, ahora: () => number, recargar: () => void) {
  return (): boolean => {
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
    recargar()
    return true
  }
}

/**
 * Envuelve la carga de una pantalla: si falla y se puede recargar, se queda
 * esperando (la página ya se está recargando); si no, el error sigue.
 */
export function conRecarga<T>(cargar: () => Promise<T>, intentarRecarga: () => boolean = recargarPagina): () => Promise<T> {
  return () =>
    cargar().catch((error: unknown) => {
      if (intentarRecarga()) return new Promise<T>(() => {})
      throw error
    })
}

const recargarPagina = () =>
  crearRecarga(
    {
      leer: () => sessionStorage.getItem(LLAVE),
      escribir: (valor) => sessionStorage.setItem(LLAVE, valor),
    },
    () => Date.now(),
    () => window.location.reload(),
  )()
