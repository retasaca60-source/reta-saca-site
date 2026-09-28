// LAS OPERACIONES DEL NEGOCIO, escritas una sola vez.
//
// Cada operación del contrato de datos (apartar, extender, cambiar horario…)
// tiene aquí su regla como función pura: recibe la configuración, las reservas
// que importan y la hora, y regresa la reserva resultante o lanza ErrorDeDatos.
// No guarda nada.
//
// La versión simulada (datos/simulado.ts) y la real (Supabase, en el servidor)
// solo leen, llaman a estas funciones y guardan. Así una regla se corrige en un
// solo lugar y vale para las dos. Antes vivían dentro de simulado.ts y la
// versión real habría tenido que reescribirlas: un arreglo al cambio de horario
// ya había quedado solo en una de las dos.

export type { Contexto } from './contexto'
export * from './cliente'
export * from './panel'
export * from './configuracion'
export type * from './tipos'
