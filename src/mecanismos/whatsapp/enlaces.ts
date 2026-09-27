// Enlaces que abren WhatsApp con el mensaje ya escrito (RESERVAS.md §9).
//
// Sin API de WhatsApp Business: no se manda nada solo. El cliente o recepción
// tocan el botón, WhatsApp se abre con el texto listo y ellos lo envían. Es
// gratis y no requiere trámite con Meta.

/** Con número: abre ese chat. Sin número: WhatsApp pregunta a quién mandarlo. */
export function enlaceWhatsApp(texto: string, numero10?: string | null): string {
  const destino = numero10 && /^\d{10}$/.test(numero10) ? `52${numero10}` : ''
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
}

/** La dirección completa de una página del sitio, para mandarla por WhatsApp. */
export function direccion(ruta: string): string {
  return window.location.origin + ruta
}
