// Qué hacer con la reserva que la ficha ya apartó cuando el cliente vuelve a
// deslizar para pagar. Vive aparte de la pantalla para poder probarlo.

/** Lo que la ficha recuerda de su último apartado. */
export interface ApartadoDeLaFicha {
  /** Lo que se pidió (deporte, día, hora, nombre…), para saber si cambió. */
  clave: string
  apartadaHasta: number | null
  tokenPrivado: string
  /** Ya se abrió Mercado Pago para esta reserva: pudo pagarse. */
  pagoAbierto: boolean
}

export type QueHacer =
  /** Pagar la MISMA reserva: no cambió nada y sigue apartada. */
  | { tipo: 'reusar' }
  /** Apartar otra; `cancelar` es el link de la anterior que se suelta, si se puede. */
  | { tipo: 'nueva'; cancelar: string | null }

export function queHacerConLoApartado(previa: ApartadoDeLaFicha | null, clave: string, ahoraMs: number): QueHacer {
  if (!previa) return { tipo: 'nueva', cancelar: null }
  if (previa.clave === clave && (previa.apartadaHasta ?? 0) > ahoraMs) return { tipo: 'reusar' }
  // Si ya se abrió el pago, NO se cancela: pudo pagarse en Mercado Pago (el
  // navegador regresa la ficha con "atrás" aunque ya haya pagado), y
  // cancelarla le quitaría al cliente una mesa pagada sin avisarle. Sin pagar,
  // se libera sola al vencer el apartado.
  return { tipo: 'nueva', cancelar: previa.pagoAbierto ? null : previa.tokenPrivado }
}