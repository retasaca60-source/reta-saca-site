// Cómo se escriben fechas, horas, dinero y teléfonos en pantalla.

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

/** La fecha de hoy más `dia` días (0 = hoy). */
export function fechaEn(dia: number): Date {
  const f = new Date()
  f.setDate(f.getDate() + dia)
  return f
}

export function esDomingo(dia: number): boolean {
  return fechaEn(dia).getDay() === 0
}

/** "Dom 27/9" */
export function etiquetaFecha(dia: number): string {
  const f = fechaEn(dia)
  return DIAS_CORTOS[f.getDay()] + ' ' + f.getDate() + '/' + (f.getMonth() + 1)
}

/** 17 → "5:00 PM" */
export function formatoHora(hora: number): string {
  const periodo = hora >= 12 ? 'PM' : 'AM'
  const h12 = hora % 12 === 0 ? 12 : hora % 12
  return h12 + ':00 ' + periodo
}

/** 1500 → "$1,500" */
export function formatoDinero(pesos: number): string {
  return '$' + pesos.toLocaleString('es-MX')
}

/** "6621234567" → "662 123 4567" */
export function whatsappLegible(numero: string): string {
  return numero.slice(0, 3) + ' ' + numero.slice(3, 6) + ' ' + numero.slice(6)
}
