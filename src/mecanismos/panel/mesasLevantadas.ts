// Qué grupos con el tiempo cumplido ya se levantaron de su mesa, según el
// empleado que lo marcó en ESTA computadora. Es solo el aviso rojo del plano:
// para las reglas la mesa ya estaba libre desde que se cumplió la hora, así
// que esto no va a la base ni cambia la reserva.
//
// Lo que sale del navegador lo pudo escribir otra versión de la app: se
// revisa que sea una lista de textos antes de usarlo.

const LLAVE = 'reta-saca:mesas-levantadas'
const EVENTO = 'reta-saca:mesas-levantadas'
/** Las de más de dos días ya no le sirven a nadie y no se guardan. */
const VIGENCIA_MS = 2 * 24 * 60 * 60_000

type Guardado = Record<string, number>

function leer(): Guardado {
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(LLAVE) ?? '{}')
    if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {}
    const limpio: Guardado = {}
    for (const [id, en] of Object.entries(crudo)) if (typeof en === 'number') limpio[id] = en
    return limpio
  } catch {
    return {}
  }
}

/** Ids de las reservas cuyo aviso de "tiempo cumplido" ya se quitó. */
export function levantadas(): Set<string> {
  return new Set(Object.keys(leer()))
}

export function marcarLevantada(reservaId: string): void {
  const ahora = Date.now()
  const guardado = Object.fromEntries(Object.entries(leer()).filter(([, en]) => ahora - en < VIGENCIA_MS))
  guardado[reservaId] = ahora
  try {
    localStorage.setItem(LLAVE, JSON.stringify(guardado))
  } catch {
    // Sin almacenamiento: el aviso vuelve a salir al recargar, nada más.
  }
  window.dispatchEvent(new Event(EVENTO))
}

export function escucharLevantadas(aviso: () => void): () => void {
  const deOtraPestana = (e: StorageEvent) => e.key === LLAVE && aviso()
  window.addEventListener(EVENTO, aviso)
  window.addEventListener('storage', deOtraPestana)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', deOtraPestana)
  }
}
