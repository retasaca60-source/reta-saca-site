// Lo que sale hacia Sentry no puede llevar la llave de una reserva: quien
// tiene /r/<token> puede cancelarla.

import { describe, expect, it } from 'vitest'
import { limpiarUrl } from './vigilancia'

describe('limpiarUrl', () => {
  it('tapa los links de reserva, cobro y pago, y las llaves de la URL', () => {
    expect(limpiarUrl('https://sitio/r/k9hqf2bti2f2k?pago=aprobado')).toBe('https://sitio/r/[oculto]?pago=aprobado')
    expect(limpiarUrl('/c/abc123')).toBe('/c/[oculto]')
    expect(limpiarUrl('/pago/bf4a0b17-951a?preference_id=372-4248&x=1')).toBe('/pago/[oculto]?preference_id=[oculto]&x=1')
    expect(limpiarUrl('/panel/semana?dia=2026-10-20')).toBe('/panel/semana?dia=2026-10-20')
  })

  it('sobre un reporte entero en texto, tapa sin romperlo', () => {
    const reporte = { message: 'falló /c/tokenEnMensaje789', request: { url: 'http://h/r/abc' }, extra: { nota: 'ver "/r/xyz"' } }
    const limpio = JSON.parse(limpiarUrl(JSON.stringify(reporte)))
    expect(limpio).toEqual({ message: 'falló /c/[oculto]', request: { url: 'http://h/r/[oculto]' }, extra: { nota: 'ver "/r/[oculto]"' } })
  })
})
