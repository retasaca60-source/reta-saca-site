// Clip (API de Checkout, "Checkout Redireccionado"), con fetch y sin SDK: son
// dos llamadas. Reemplazó a Mercado Pago el 21/10/2026 (decisión del negocio:
// Clip cobra un porcentaje sin cuota fija por pago).
//
// Documentación: https://developer.clip.mx/reference/createnewpaymentlink y
// https://developer.clip.mx/reference/checkpaymentlinkstatus
//
// La llave (CLIP_API_KEY) vive en los secretos de la función y la pone Hugo
// desde su cuenta de Clip. OJO: según Clip, las credenciales de PRUEBA no
// funcionan con este checkout (solo con el "transparente"): para probar el
// cobro de punta a punta hace falta la llave de producción y un pago real
// chico, que se devuelve.

import type { CobroNuevo, PagoEnLinea, Pasarela } from '../../src/servidor/api'

const API = 'https://api.payclip.com/v2'

/**
 * Clip pide el vencimiento en UTC, más de un minuto después de crear el link
 * y antes de las 23:59:59 de la Ciudad de México del mismo día. El apartado
 * dura 10 minutos, así que casi siempre cabe; cerca de la medianoche de la
 * CDMX (las 11 PM de Sonora) se recorta a ese límite, y si ya no queda ni un
 * minuto se deja sin vencimiento: el pago que llegue tarde se maneja como
 * cualquier pago tardío (se acepta si la mesa sigue libre; si no, queda por
 * devolver).
 */
export function vencimientoParaClip(venceEn: number | null, ahora: number): string | null {
  if (!venceEn) return null
  // Fin del día en la Ciudad de México (UTC−6 todo el año desde 2022).
  const cdmx = new Date(ahora - 6 * 3_600_000)
  const finDelDia = Date.UTC(cdmx.getUTCFullYear(), cdmx.getUTCMonth(), cdmx.getUTCDate(), 23, 59, 0) + 6 * 3_600_000
  const vence = Math.min(venceEn, finDelDia)
  if (vence - ahora < 90_000) return null
  return new Date(vence).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** "Bearer <llave>" salvo que el secreto ya traiga su esquema (Basic o Bearer). */
const autorizacion = (llave: string) => (/^(Basic|Bearer) /.test(llave) ? llave : `Bearer ${llave}`)

export function clipReal(llave: string, opciones: { avisoA: string }): Pasarela {
  const pedir = (ruta: string, init: RequestInit = {}) =>
    fetch(API + ruta, {
      ...init,
      headers: { Authorization: autorizacion(llave), 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
    })

  return {
    async crearCobro(c: CobroNuevo) {
      const vence = vencimientoParaClip(c.venceEn, Date.now())
      const respuesta = await pedir('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          amount: c.monto,
          currency: 'MXN',
          purchase_description: c.titulo.slice(0, 250),
          // Al regresar, el sitio solo sabe el intento: con él busca el cobro.
          redirection_url: {
            success: `${c.volverA}?pago=aprobado&intento=${c.intentoId}`,
            error: `${c.volverA}?pago=cancelado&intento=${c.intentoId}`,
            default: c.volverA,
          },
          metadata: { external_reference: c.intentoId },
          webhook_url: opciones.avisoA,
          ...(vence ? { expires_at: vence } : {}),
        }),
      })
      if (!respuesta.ok) throw new Error(`Clip no creó el cobro (${respuesta.status}): ${await respuesta.text()}`)
      const link = (await respuesta.json()) as { payment_request_id?: string; payment_request_url?: string }
      if (!link.payment_request_id || !link.payment_request_url) throw new Error('Clip no devolvió el link de pago')
      return { url: link.payment_request_url, cobroId: link.payment_request_id }
    },

    async consultarCobro(cobroId: string): Promise<PagoEnLinea | null> {
      const respuesta = await pedir(`/checkout/${encodeURIComponent(cobroId)}`)
      if (respuesta.status === 404) return null
      if (!respuesta.ok) throw new Error(`Clip no contestó por el cobro ${cobroId} (${respuesta.status})`)
      const c = (await respuesta.json()) as {
        payment_request_id: string
        status: string
        amount: number
        currency: string
        metadata?: { external_reference?: string | null }
      }
      return {
        id: c.payment_request_id ?? cobroId,
        pagado: c.status === 'CHECKOUT_COMPLETED',
        referencia: c.metadata?.external_reference ?? null,
        monto: Number(c.amount),
        moneda: c.currency,
      }
    },
  }
}
