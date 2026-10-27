import { describe, expect, it, vi } from 'vitest'
import { crearRecarga } from './recarga'

function almacenEnMemoria() {
  let valor: string | null = null
  return { leer: () => valor, escribir: (v: string) => void (valor = v) }
}

const evento = () => ({ preventDefault: vi.fn() })

describe('recargar cuando falta un archivo de la página', () => {
  it('recarga una vez y no deja que el error siga', () => {
    const recargar = vi.fn()
    const e = evento()
    expect(crearRecarga(almacenEnMemoria(), () => 1_000_000, recargar)(e)).toBe(true)
    expect(recargar).toHaveBeenCalledOnce()
    expect(e.preventDefault).toHaveBeenCalledOnce()
  })

  it('si vuelve a fallar en menos de un minuto, no recarga: el error sigue y llega a Sentry', () => {
    const almacen = almacenEnMemoria()
    let ahora = 1_000_000
    const recargar = vi.fn()
    const alFallar = crearRecarga(almacen, () => ahora, recargar)
    alFallar(evento())
    ahora += 30_000
    const segundo = evento()
    expect(alFallar(segundo)).toBe(false)
    expect(segundo.preventDefault).not.toHaveBeenCalled()
    expect(recargar).toHaveBeenCalledOnce()
    // Pasado el minuto, una versión nueva vuelve a poder recargar.
    ahora += 60_000
    expect(alFallar(evento())).toBe(true)
  })

  it('sin poder apuntar la recarga, no recarga (evita una página que se recarga sin fin)', () => {
    const recargar = vi.fn()
    const roto = {
      leer: () => null,
      escribir: () => {
        throw new Error('sin almacenamiento')
      },
    }
    expect(crearRecarga(roto, () => 1_000_000, recargar)(evento())).toBe(false)
    expect(recargar).not.toHaveBeenCalled()
  })
})
