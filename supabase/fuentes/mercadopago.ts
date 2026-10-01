// Mercado Pago (Checkout Pro, API de Preferences), con fetch y sin su SDK:
// son dos llamadas y así no hay otra dependencia que empaquetar y vigilar.
//
// La llave (MP_ACCESS_TOKEN) vive en los secretos de la función. Con la de
// prueba se cobra de mentira; con la de producción del negocio, de verdad. El
// código es el mismo: al pasar a producción solo cambia el secreto.

import type { CobroNuevo, MercadoPago, PagoDeMercadoPago } from '../../src/servidor/api'

const API = 'https://api.mercadopago.com'

/** Mercado Pago pide la fecha con zona: "2026-09-30T19:10:00.000+00:00". */
const fechaMP = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00')

export function mercadoPagoReal(llave: string, opciones: { avisoA: string; usarSandbox: boolean }): MercadoPago {
  const pedir = (ruta: string, init: RequestInit = {}) =>
    fetch(API + ruta, {
      ...init,
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json', ...init.headers },
    })

  return {
    async crearCobro(c: CobroNuevo) {
      const ahora = Date.now()
      const respuesta = await pedir('/checkout/preferences', {
        method: 'POST',
        // Si la red falla y se reintenta, Mercado Pago no crea dos cobros.
        headers: { 'X-Idempotency-Key': c.intentoId },
        body: JSON.stringify({
          items: [{ id: c.intentoId, title: c.titulo, quantity: 1, unit_price: c.monto, currency_id: 'MXN' }],
          external_reference: c.intentoId,
          notification_url: opciones.avisoA,
          back_urls: {
            success: `${c.volverA}?pago=aprobado`,
            failure: `${c.volverA}?pago=cancelado`,
            pending: `${c.volverA}?pago=pendiente`,
          },
          // El regreso automático solo se acepta con https (en localhost no).
          ...(c.volverA.startsWith('https://') ? { auto_return: 'approved' } : {}),
          // Aprobado o rechazado, sin "pendiente": la mesa está apartada unos
          // minutos y no puede esperar un pago que se confirma horas después.
          binary_mode: true,
          payment_methods: {
            // OXXO, cajeros y transferencias se confirman tarde: fuera.
            excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }],
            installments: 1,
          },
          // Vence con el apartado: después ya no hay mesa garantizada.
          ...(c.venceEn ? { expires: true, expiration_date_from: fechaMP(ahora), expiration_date_to: fechaMP(c.venceEn) } : {}),
          statement_descriptor: 'RETASACA',
        }),
      })
      if (!respuesta.ok) throw new Error(`Mercado Pago no creó el cobro (${respuesta.status}): ${await respuesta.text()}`)
      const preferencia = (await respuesta.json()) as { init_point?: string; sandbox_init_point?: string }
      const url = opciones.usarSandbox ? preferencia.sandbox_init_point : preferencia.init_point
      if (!url) throw new Error('Mercado Pago no devolvió a dónde mandar a pagar')
      return url
    },

    async consultarPago(id: string): Promise<PagoDeMercadoPago | null> {
      const respuesta = await pedir(`/v1/payments/${encodeURIComponent(id)}`)
      if (respuesta.status === 404) return null
      if (!respuesta.ok) throw new Error(`Mercado Pago no contestó por el pago ${id} (${respuesta.status})`)
      const p = (await respuesta.json()) as {
        id: number
        status: string
        external_reference: string | null
        transaction_amount: number
        currency_id: string
      }
      return { id: String(p.id), estado: p.status, referencia: p.external_reference, monto: p.transaction_amount, moneda: p.currency_id }
    },
  }
}
