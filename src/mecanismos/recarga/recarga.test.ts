import { describe, expect, it, vi } from 'vitest'
import { conRecarga, crearRecarga } from './recarga'

function almacenEnMemoria() {
  let valor: string | null = null
  return { leer: () => valor, escribir: (v: string) => void (valor = v) }
}

describe('recargar cuando falta un archivo de la página', () => {
  it('recarga una vez', () => {
    const recargar = vi.fn()
    expect(crearRecarga(almacenEnMemoria(), () => 1_000_000, recargar)()).toBe(true)
    expect(recargar).toHaveBeenCalledOnce()
  })

  it('si vuelve a fallar en menos de un minuto, no recarga otra vez', () => {
    let ahora = 1_000_000
    const recargar = vi.fn()
    const intentar = crearRecarga(almacenEnMemoria(), () => ahora, recargar)
    intentar()
    ahora += 30_000
    expect(intentar()).toBe(false)
    expect(recargar).toHaveBeenCalledOnce()
    // Pasado el minuto, una versión nueva vuelve a poder recargar.
    ahora += 60_000
    expect(intentar()).toBe(true)
  })

  it('sin poder apuntar la recarga, no recarga (evita una página que se recarga sin fin)', () => {
    const recargar = vi.fn()
    const roto = {
      leer: () => null,
      escribir: () => {
        throw new Error('sin almacenamiento')
      },
    }
    expect(crearRecarga(roto, () => 1_000_000, recargar)()).toBe(false)
    expect(recargar).not.toHaveBeenCalled()
  })
})

describe('cargar una pantalla con recarga', () => {
  it('si carga, entrega la pantalla tal cual', async () => {
    const pantalla = { default: () => null }
    await expect(conRecarga(async () => pantalla, () => true)()).resolves.toBe(pantalla)
  })

  it('si falla y recarga, se queda esperando en vez de tronar', async () => {
    const espera = conRecarga(() => Promise.reject(new Error('Failed to fetch dynamically imported module')), () => true)()
    const resultado = await Promise.race([espera.then(() => 'resolvió', () => 'tronó'), new Promise((r) => setTimeout(() => r('esperando'), 50))])
    expect(resultado).toBe('esperando')
  })

  it('si falla y ya no puede recargar, el error sigue para que lo vea la persona y Sentry', async () => {
    await expect(conRecarga(() => Promise.reject(new Error('sin archivo')), () => false)()).rejects.toThrow('sin archivo')
  })
})
