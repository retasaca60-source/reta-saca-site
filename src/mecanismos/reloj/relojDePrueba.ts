// El reloj de prueba de la demostración: adelantar o atrasar la hora para ver
// cómo se comporta todo a las 7 de la noche, mañana, o cuando vence un
// apartado, sin esperar. Solo la demostración lo usa (datos/index.ts); la
// versión real siempre va con la hora del servidor.
//
// Se guarda cuánto se movió la hora, no una hora fija: así el reloj sigue
// avanzando desde ahí, y recargar o abrir el sitio en otra pestaña del mismo
// navegador ve la misma hora.

const LLAVE = 'reta-saca:reloj'
const EVENTO = 'reta-saca:reloj'

/** Cuántos ms está movida la hora (0 = la hora real). */
export function desplazamiento(): number {
  try {
    const n = Number(localStorage.getItem(LLAVE))
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** La hora de la demostración, en ms. */
export const horaDePrueba = () => Date.now() + desplazamiento()

export function moverReloj(ms: number): void {
  fijarDesplazamiento(desplazamiento() + ms)
}

/** Lleva el reloj a un instante concreto (ms). */
export function irA(instante: number): void {
  fijarDesplazamiento(instante - Date.now())
}

export function horaReal(): void {
  fijarDesplazamiento(0)
}

function fijarDesplazamiento(ms: number): void {
  try {
    if (ms === 0) localStorage.removeItem(LLAVE)
    else localStorage.setItem(LLAVE, String(Math.round(ms)))
  } catch {
    // Sin almacenamiento (modo privado): el reloj se queda en la hora real.
  }
  window.dispatchEvent(new Event(EVENTO))
}

/** Avisa cuando alguien mueve el reloj, aquí o en otra pestaña. */
export function escucharReloj(aviso: () => void): () => void {
  const deOtraPestana = (e: StorageEvent) => e.key === LLAVE && aviso()
  window.addEventListener(EVENTO, aviso)
  window.addEventListener('storage', deOtraPestana)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', deOtraPestana)
  }
}
