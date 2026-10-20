import { describe, expect, it } from 'vitest'
import { queHacerConLoApartado, type ApartadoDeLaFicha } from './apartadoDeLaFicha'

const AHORA = 1_000_000
const previa = (cambios: Partial<ApartadoDeLaFicha> = {}): ApartadoDeLaFicha => ({
  clave: 'PP 7 PM Ana', apartadaHasta: AHORA + 5 * 60_000, tokenPrivado: 'tok', pagoAbierto: false, ...cambios,
})

describe('lo apartado por la ficha', () => {
  it('sin nada apartado, aparta una nueva', () => {
    expect(queHacerConLoApartado(null, 'x', AHORA)).toEqual({ tipo: 'nueva', cancelar: null })
  })
  it('si no cambió nada y sigue apartada, paga la misma (también tras regresar de Mercado Pago)', () => {
    expect(queHacerConLoApartado(previa({ pagoAbierto: true }), 'PP 7 PM Ana', AHORA)).toEqual({ tipo: 'reusar' })
  })
  it('si cambió algo y nunca se abrió el pago, suelta la anterior', () => {
    expect(queHacerConLoApartado(previa(), 'PP 8 PM Ana', AHORA)).toEqual({ tipo: 'nueva', cancelar: 'tok' })
  })
  it('si ya se abrió el pago, NUNCA la cancela: pudo pagarse', () => {
    expect(queHacerConLoApartado(previa({ pagoAbierto: true }), 'PP 8 PM Ana', AHORA)).toEqual({ tipo: 'nueva', cancelar: null })
    // Misma reserva pero ya pasaron los 10 minutos (regresó con "atrás" mucho después).
    expect(queHacerConLoApartado(previa({ pagoAbierto: true, apartadaHasta: AHORA - 1 }), 'PP 7 PM Ana', AHORA)).toEqual({ tipo: 'nueva', cancelar: null })
  })
})