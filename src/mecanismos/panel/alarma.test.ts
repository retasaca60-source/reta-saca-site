import { describe, expect, it } from 'vitest'
import type { Reserva } from '../../negocio/reserva'
import { seAcabaronEntre } from './alarma'

// Solo los campos que miran la alarma y fin(); el resto no importa aquí.
const grupo = (id: string, inicio: number, duracion: number, extra: Partial<Reserva> = {}) =>
  ({ id, estado: 'confirmada', mesa: 'PP 1', inicio, duracion, ...extra }) as Reserva

const ninguna = new Set<string>()

describe('cuándo suena la alarma de tiempo cumplido', () => {
  it('suena para el grupo cuya hora de fin quedó entre las dos lecturas del reloj', () => {
    const r = grupo('a', 18 * 60, 60)
    expect(seAcabaronEntre([r], 18 * 60 + 59, 19 * 60, ninguna)).toEqual([r])
    expect(seAcabaronEntre([r], 18 * 60 + 59.5, 19 * 60 + 0.5, ninguna)).toEqual([r])
  })

  it('no vuelve a sonar en la lectura siguiente, ni para lo que ya había terminado al abrir', () => {
    const r = grupo('a', 18 * 60, 60)
    expect(seAcabaronEntre([r], 19 * 60, 19 * 60 + 1, ninguna)).toEqual([])
    expect(seAcabaronEntre([r], 19 * 60 + 30, 19 * 60 + 31, ninguna)).toEqual([])
  })

  it('con tiempo extra suena a la hora nueva, no a la vieja', () => {
    const extendida = grupo('a', 18 * 60, 90)
    expect(seAcabaronEntre([extendida], 18 * 60 + 59, 19 * 60, ninguna)).toEqual([])
    expect(seAcabaronEntre([extendida], 19 * 60 + 29, 19 * 60 + 30, ninguna)).toEqual([extendida])
  })

  it('no suena para quien no está sentado, ya se levantó o no está confirmado', () => {
    const sinMesa = grupo('a', 18 * 60, 60, { mesa: null })
    const levantado = grupo('b', 18 * 60, 60)
    const cancelada = grupo('c', 18 * 60, 60, { estado: 'cancelada' })
    expect(seAcabaronEntre([sinMesa, levantado, cancelada], 18 * 60 + 59, 19 * 60, new Set(['b']))).toEqual([])
  })
})
