import { describe, expect, it } from 'vitest'
import { sePuedeReintentar } from './conexionSupabase'

describe('pedir otra vez cuando falla la plataforma', () => {
  it('una lectura se repite si Supabase falló (546, 503) o no hubo conexión', () => {
    expect(sePuedeReintentar('yo', 546)).toBe(true)
    expect(sePuedeReintentar('disponibilidad', 503)).toBe(true)
    expect(sePuedeReintentar('reservasEntre', null)).toBe(true)
  })
  it('lo que escribe nunca se repite solo: si la primera vez llegó, se haría dos veces', () => {
    for (const accion of ['apartar', 'iniciarPago', 'marcarPago', 'extender', 'anotarSinReserva', 'guardarConfiguracion', 'verificarPagoEnLinea']) {
      expect(sePuedeReintentar(accion, 546)).toBe(false)
    }
  })
  it('una respuesta nuestra (400, 401) no se repite: ya trae su mensaje', () => {
    expect(sePuedeReintentar('yo', 401)).toBe(false)
    expect(sePuedeReintentar('disponibilidad', 400)).toBe(false)
  })
})
