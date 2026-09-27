// Qué versión de los datos usa la aplicación.
//
// Hoy siempre la simulada. Cuando exista la real (Supabase + Mercado Pago), se
// elige con la variable de entorno VITE_DATOS=real en Netlify, y este es el
// ÚNICO archivo que cambia: las pantallas importan `servicio` de aquí y nada más.

import type { ServicioDeDatos } from './contrato'
import { crearServicioSimulado, type ServicioSimulado } from './simulado'

const simulado: ServicioSimulado = crearServicioSimulado({ demoraMs: 150 })

export const servicio: ServicioDeDatos = simulado

/** Las pantallas que solo existen en la demostración (el pago de mentira) usan esto. */
export const servicioSimulado: ServicioSimulado | null = servicio.modo === 'simulado' ? simulado : null

export { ErrorDeDatos } from './contrato'
export type * from './contrato'
