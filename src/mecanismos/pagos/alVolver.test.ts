// Al regresar de Clip, el cobro se registra UNA vez aunque la pantalla
// se recargue cada 30 segundos; si falló, se reintenta en la siguiente.

import { describe, expect, it, vi } from 'vitest'

const verificar = vi.fn<(pagoId: string) => Promise<void>>()
vi.mock('../../datos', () => ({ servicio: { verificarPagoEnLinea: (id: string) => verificar(id) } }))

const { registrarAlVolver } = await import('./alVolver')

describe('registrar el pago al volver', () => {
  it('pregunta una sola vez por el mismo pago, y reintenta solo si falló', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    verificar.mockRejectedValueOnce(new Error('sin red'))
    await registrarAlVolver('123') // falla: se reintentará
    await registrarAlVolver('123') // ahora sí
    await registrarAlVolver('123') // ya registrado: no pregunta
    await registrarAlVolver(null)
    expect(verificar).toHaveBeenCalledTimes(2)
  })
})