// El conector de Clip (supabase/fuentes/clip.ts) con un fetch de mentira: lo
// que se le manda a Clip y cómo se lee lo que contesta. El cobro de verdad no
// se puede probar con llaves de prueba (Clip no las acepta en este checkout).

import { afterEach, describe, expect, it, vi } from 'vitest'
import {autorizacion, clipReal, vencimientoParaClip } from '../../supabase/fuentes/clip'

const MINUTO = 60_000
/** Un instante en la Ciudad de México (UTC−6). */
const cdmx = (dia: string, hora: number, minuto = 0) => Date.parse(`${dia}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-06:00`)

afterEach(() => vi.unstubAllGlobals())

describe('vencimiento del link de Clip', () => {
  it('es el del apartado, en UTC y sin milisegundos', () => {
    const ahora = cdmx('2026-10-21', 19)
    expect(vencimientoParaClip(ahora + 10 * MINUTO, ahora)).toBe('2026-10-22T01:10:00Z')
  })
  it('cerca de la medianoche de la CDMX se recorta a las 23:59', () => {
    const ahora = cdmx('2026-10-21', 23, 52)
    expect(vencimientoParaClip(ahora + 10 * MINUTO, ahora)).toBe('2026-10-22T05:59:00Z')
  })
  it('si ya no queda ni minuto y medio, va sin vencimiento', () => {
    const ahora = cdmx('2026-10-21', 23, 58)
    expect(vencimientoParaClip(ahora + 10 * MINUTO, ahora)).toBeNull()
    expect(vencimientoParaClip(null, ahora)).toBeNull()
  })
})
describe('llave de Clip', () => {
  it('arma Basic con base64 de "API key:clave secreta", como lo pide Clip', () => {
    expect(autorizacion('mi-api-key:mi-clave-secreta')).toBe(`Basic ${btoa('mi-api-key:mi-clave-secreta')}`)
    expect(autorizacion('  mi-api-key:mi-clave-secreta\n')).toBe(`Basic ${btoa('mi-api-key:mi-clave-secreta')}`)
  })
  it('acepta el token ya armado, con o sin "Basic "', () => {
    expect(autorizacion('YWJjOmRlZg==')).toBe('Basic YWJjOmRlZg==')
    expect(autorizacion('Basic YWJjOmRlZg==')).toBe('Basic YWJjOmRlZg==')
  })
  it('nunca manda "Bearer" a menos que el secreto lo diga', () => {
    expect(autorizacion('llave')).not.toMatch(/^Bearer/)
  })
})
describe('conector de Clip', () => {
  it('crea el link con el monto, la referencia del intento, el aviso y el regreso con el intento', async () => {
    const pedir = vi.fn(async () => new Response(JSON.stringify({ payment_request_id: 'pr-1', payment_request_url: 'https://pago.clip.mx/pr-1' }), { status: 200 }))
    vi.stubGlobal('fetch', pedir)
    const r = await clipReal('llave', { avisoA: 'https://api.test/?aviso=clip' }).crearCobro({
      intentoId: 'int-1',
      titulo: 'Reta Saca · Cornhole · RS-ABCDE',
      monto: 280,
      volverA: 'https://sitio.test/r/tok',
      venceEn: null,
    })
    expect(r).toEqual({ url: 'https://pago.clip.mx/pr-1', cobroId: 'pr-1' })
    const [url, init] = pedir.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.payclip.com/v2/checkout')
    expect((init.headers as Record<string, string>).Authorization).toBe('Basic llave')
    expect(JSON.parse(init.body as string)).toMatchObject({
      amount: 280,
      currency: 'MXN',
      metadata: { external_reference: 'int-1' },
      webhook_url: 'https://api.test/?aviso=clip',
      redirection_url: { success: 'https://sitio.test/r/tok?pago=aprobado&intento=int-1', default: 'https://sitio.test/r/tok' },
    })
  })

  it('respeta el esquema si la llave ya lo trae (Basic)', async () => {
    const pedir = vi.fn(async () => new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', pedir)
    expect(await clipReal('Basic abc', { avisoA: '' }).consultarCobro('pr-1')).toBeNull()
    const [, init] = pedir.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Basic abc')
  })

  it('solo da por pagado un cobro COMPLETED, con su monto y su referencia', async () => {
    const respuesta = (status: string) =>
      new Response(JSON.stringify({ payment_request_id: 'pr-1', status, amount: 280, currency: 'MXN', metadata: { external_reference: 'int-1' } }), { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => respuesta('CHECKOUT_COMPLETED')))
    expect(await clipReal('llave', { avisoA: '' }).consultarCobro('pr-1')).toEqual({ id: 'pr-1', pagado: true, referencia: 'int-1', monto: 280, moneda: 'MXN' })
    vi.stubGlobal('fetch', vi.fn(async () => respuesta('CHECKOUT_PENDING')))
    expect((await clipReal('llave', { avisoA: '' }).consultarCobro('pr-1'))!.pagado).toBe(false)
  })

  it('si Clip falla, lanza (para que su aviso se reintente)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('caído', { status: 503 })))
    await expect(clipReal('llave', { avisoA: '' }).consultarCobro('pr-1')).rejects.toThrow('503')
  })
})
