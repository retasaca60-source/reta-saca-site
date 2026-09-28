// Folios, códigos de link e ids. Con crypto: sirve igual en el navegador y en
// el servidor (Node), así la versión simulada y la real los generan igual.

// Sin 0/O ni 1/I/L: el folio se dicta por teléfono y ahí se confunden.
const LETRAS_FOLIO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const LETRAS_TOKEN = 'abcdefghijkmnpqrstuvwxyz23456789'

const azar = (n: number, letras: string) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => letras[b % letras.length]).join('')

export const nuevoId = () => crypto.randomUUID()

/**
 * Folio que se dicta: "RS-4KD9Q". Que no se repita lo garantiza quien guarda:
 * la versión simulada revisa los existentes y la real, una restricción única.
 */
export const nuevoFolio = () => 'RS-' + azar(5, LETRAS_FOLIO)

/** Código de 14 letras de los links /r/… y /c/…: imposible de adivinar. */
export const nuevoToken = () => azar(14, LETRAS_TOKEN)
