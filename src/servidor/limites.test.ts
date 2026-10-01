// El límite por dirección del servidor (CN-003): lo que no puede probar la
// versión simulada, porque allá no hay direcciones.

import { beforeEach, describe, expect, it } from 'vitest'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import { instante } from '../negocio/tiempo'
import { atender, type Entorno } from './api'
import { repositorioEnMemoria } from './repositorio'

let reloj = instante('2026-09-25', 15 * 60)
let e: Entorno

/** El código de error de la respuesta, o "sin error". */
async function codigo(accion: string, cliente: string | null): Promise<string> {
  const r = await atender({ accion, datos: {} }, { ...e, cliente })
  return 'error' in r ? r.error.codigo : 'sin error'
}

beforeEach(() => {
  reloj = instante('2026-09-25', 15 * 60)
  e = {
    repo: repositorioEnMemoria(CONFIGURACION_INICIAL),
    ahora: () => reloj,
    cuentaId: null,
    cuentas: { crear: async () => 'x', borrar: async () => {} },
    pagosSimulados: true,
    mercadoPago: null,
    sitio: 'https://retasaca-hmo2.netlify.app',
    cliente: null,
  }
})

describe('límite por dirección', () => {
  it('a la vigésima primera llamada de apartar en 10 minutos, esa dirección se frena; las demás no', async () => {
    // Se cuenta ANTES de revisar los datos: un script que manda basura también gasta su cupo.
    for (let i = 0; i < 20; i++) expect(await codigo('apartar', '200.1.1.1')).toBe('datos_invalidos')
    expect(await codigo('apartar', '200.1.1.1')).toBe('demasiados_intentos')
    expect(await codigo('apartar', '200.2.2.2')).toBe('datos_invalidos')
  })

  it('la ventana se reinicia a los 10 minutos', async () => {
    for (let i = 0; i < 21; i++) await codigo('apartar', '200.1.1.1')
    reloj += 10 * 60_000
    expect(await codigo('apartar', '200.1.1.1')).toBe('datos_invalidos')
  })

  it('sin dirección conocida no se frena a nadie', async () => {
    for (let i = 0; i < 25; i++) expect(await codigo('apartar', null)).toBe('datos_invalidos')
  })

  it('si el contador falla, deja pasar en vez de tumbar las reservas', async () => {
    e.repo.contarIntento = async () => {
      throw new Error('la tabla no existe')
    }
    expect(await codigo('apartar', '200.1.1.1')).toBe('datos_invalidos')
  })
})
