// Cómo se escriben dinero y teléfonos en pantalla. Fechas y horas: tiempo.ts.

/** 1500 → "$1,500" */
export function formatoDinero(pesos: number): string {
  return '$' + pesos.toLocaleString('es-MX')
}

/** "6621234567" → "662 123 4567" */
export function whatsappLegible(numero: string): string {
  return numero.slice(0, 3) + ' ' + numero.slice(3, 6) + ' ' + numero.slice(6)
}
