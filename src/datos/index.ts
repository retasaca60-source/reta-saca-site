// Qué versión de los datos usa la aplicación.
//
// Con VITE_DATOS=real (y la URL y llave publicable de Supabase), la real; si
// no, la simulada. Este es el ÚNICO archivo que decide: las pantallas importan
// `servicio` de aquí y nada más. Las variables van en .env.local para probar
// en esta computadora y en Netlify para el sitio publicado.

import type { PagoSimulado, ServicioDeDatos } from './contrato'
import { conexionSupabase } from './conexionSupabase'
import { crearServicioReal, type ServicioReal } from './real'
import { crearServicioSimulado, type ServicioSimulado } from './simulado'
import { escucharReloj, horaDePrueba } from '../mecanismos/reloj/relojDePrueba'
import { usarReloj } from '../negocio/tiempo'

function elegirReal(): ServicioReal | null {
  const { VITE_DATOS, VITE_SUPABASE_URL, VITE_SUPABASE_LLAVE_PUBLICA } = import.meta.env
  if (VITE_DATOS !== 'real') return null
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_LLAVE_PUBLICA) {
    // Mejor fallar a la vista que caer en silencio a la simulada con datos de mentira.
    throw new Error('VITE_DATOS=real pero faltan VITE_SUPABASE_URL o VITE_SUPABASE_LLAVE_PUBLICA')
  }
  return crearServicioReal(conexionSupabase(VITE_SUPABASE_URL, VITE_SUPABASE_LLAVE_PUBLICA))
}

const real = elegirReal()
// La simulada solo se crea si se usa: siembra reservas de ejemplo en el navegador.
// Va con el reloj de prueba (la hora que se mueve desde el panel), y las
// pantallas y las reglas usan esa misma hora para que todo cuadre.
const simulado: ServicioSimulado | null = real ? null : crearServicioSimulado({ demoraMs: 150, reloj: horaDePrueba })
if (simulado) {
  usarReloj(horaDePrueba)
  // Mover el reloj cambia qué está apartado, en juego o vencido: las pantallas
  // vuelven a cargar igual que cuando cambian los datos.
  const alCambiar = simulado.alCambiar
  simulado.alCambiar = (aviso) => {
    const dejarDatos = alCambiar(aviso)
    const dejarReloj = escucharReloj(aviso)
    return () => {
      dejarDatos()
      dejarReloj()
    }
  }
}

export const servicio: ServicioDeDatos = real ?? simulado!

/** Lo que solo existe en la demostración (restablecer, entrar sin contraseña). */
export const servicioSimulado: ServicioSimulado | null = simulado

/** La pantalla que ocupa el lugar de Mercado Pago, en cualquiera de las dos versiones. */
export const pagoSimulado: PagoSimulado = (real ?? simulado!).pagoSimulado

export { ErrorDeDatos } from './contrato'
export type * from './contrato'
