// El aviso de que todo es de demostración. Desaparece solo cuando los datos son
// los reales (datos/index.ts): mientras tanto tiene que verse en cada pantalla.

import { servicio } from '../datos'

export function AvisoDemo() {
  if (servicio.modo !== 'simulado') return null
  return <p className="aviso-demo">Demostración: no se cobra nada y las reservas se quedan en este navegador.</p>
}
