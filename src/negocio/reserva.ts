// Qué es una reserva y las reglas que dependen solo de ella: cuánto falta
// pagar, si ocupa mesa, si se puede cancelar o liberar. Sin pantallas.

import type { Configuracion, DeporteId, Duracion, Partes } from './configuracion'
import { instante } from './tiempo'

// Sin transferencia: el negocio cobra en el local solo en efectivo o con la terminal.
export type MedioDePago = 'en_linea' | 'efectivo' | 'tarjeta'

export interface Pago {
  medio: MedioDePago
  /** Quién pagó (el nombre que dio en el link de cobro, o el organizador). */
  nombre: string
  /** Instante ISO. */
  en: string
  /** En pagos del local: quién de recepción lo marcó. */
  marcadoPor?: string
  /** Pago en línea que el negocio devolvió por transferencia tras una cancelación. */
  devuelto?: boolean
}

/**
 * Lo pagado en línea de una reserva cancelada. El sistema no devuelve dinero
 * ni promete devolverlo: el negocio decide caso por caso y, si devuelve, lo
 * transfiere desde su banco. Antes se marcaba "devuelto" al cancelar, dando por
 * hecho que Mercado Pago lo regresaba solo; el negocio prefirió decidir él.
 */
export interface Devolucion {
  /** Lo pagado en línea al momento de cancelar. */
  monto: number
  estado: 'por_revisar' | 'transferida' | 'sin_devolucion'
  /** Quién de recepción lo resolvió, y cuándo (ISO). */
  por?: string
  en?: string
}

export interface Parte {
  id: string
  monto: number
  /** La parte del organizador: la primera, la que absorbe los centavos. */
  delOrganizador: boolean
  /** Qué es: la reserva, una extensión de tiempo o una diferencia por cambio de horario. */
  concepto: 'reserva' | 'extension' | 'cambio'
  pago: Pago | null
}

export type EstadoReserva =
  /** Esperando el primer pago; ocupa la mesa hasta `apartadaHasta`. */
  | 'apartada'
  /** Con al menos un pago (o anotada en el mostrador): la mesa es suya. */
  | 'confirmada'
  | 'cancelada'

export type MotivoCancelacion = 'cliente' | 'negocio' | 'no_llego' | 'apartado_vencido'

export interface Reserva {
  id: string
  /** Folio que se dicta: "RS-4KD9Q". */
  folio: string
  /** Link privado del organizador: /r/<token>. */
  tokenPrivado: string
  /** Link de cobro para los amigos: /c/<token>. */
  tokenCobro: string
  deporte: DeporteId
  /** "AAAA-MM-DD" en Sonora. */
  fecha: string
  /** Minutos desde medianoche en Sonora. */
  inicio: number
  /** Minutos. Puede crecer si recepción extiende. */
  duracion: number
  /** Precio de la reserva al momento de hacerla (no cambia si Hugo cambia precios). */
  precio: number
  conPromo: boolean
  partesElegidas: Partes
  partes: Parte[]
  organizador: { nombre: string; whatsapp: string }
  origen: 'sitio' | 'mostrador'
  estado: EstadoReserva
  /** Instante (ms) en que vence el apartado mientras paga. */
  apartadaHasta: number | null
  /** Número de mesa que asignó recepción al llegar, "CH 3". */
  mesa: string | null
  llegaronEn: string | null
  cancelacion: { motivo: MotivoCancelacion; en: string; por?: string } | null
  /** Solo en canceladas que tenían pagos en línea. Falta en las guardadas antes de que existiera. */
  devolucion?: Devolucion | null
  creadaEn: string
}

export const fin = (r: Pick<Reserva, 'inicio' | 'duracion'>) => r.inicio + r.duracion

/** ¿Esta reserva está ocupando una mesa ahora mismo en el inventario? */
export function ocupaMesa(r: Reserva, ahoraMs: number): boolean {
  if (r.estado === 'confirmada') return true
  if (r.estado === 'apartada') return r.apartadaHasta !== null && r.apartadaHasta > ahoraMs
  return false
}

export const total = (r: Reserva) => r.partes.reduce((s, p) => s + p.monto, 0)
export const pagado = (r: Reserva) => r.partes.reduce((s, p) => s + (p.pago && !p.pago.devuelto ? p.monto : 0), 0)
export const pendiente = (r: Reserva) => total(r) - pagado(r)
export const partesPendientes = (r: Reserva) => r.partes.filter((p) => !p.pago)
/** Lo pagado en línea que sigue en manos del negocio (sin lo ya devuelto). */
export const pagadoEnLinea = (r: Reserva) =>
  r.partes.reduce((s, p) => s + (p.pago?.medio === 'en_linea' && !p.pago.devuelto ? p.monto : 0), 0)

/**
 * Divide un total en partes de pesos cerrados. La primera es la del
 * organizador y absorbe lo que sobre: $150 entre 4 → [39, 37, 37, 37].
 * En efectivo nadie trae centavos.
 */
export function repartir(total: number, partes: number): number[] {
  const base = Math.floor(total / partes)
  return [total - base * (partes - 1), ...Array(partes - 1).fill(base)]
}


/** ¿Ya pasó la tolerancia sin que llegaran? Recepción puede liberar la mesa. */
export function puedeLiberarPorRetraso(r: Reserva, config: Configuracion, ahoraMs: number): boolean {
  return (
    r.estado === 'confirmada' &&
    !r.llegaronEn &&
    ahoraMs >= instante(r.fecha, r.inicio) + config.reglas.minutosDeTolerancia * 60_000
  )
}

/** Si la reserva sigue vigente para contarla como "activa" (límite por WhatsApp). */
export function estaActiva(r: Reserva, ahoraMs: number): boolean {
  return ocupaMesa(r, ahoraMs) && instante(r.fecha, fin(r)) > ahoraMs
}

/** Duraciones con que se puede extender una reserva: de 30 en 30, hasta 2 horas más. */
export const EXTENSIONES: Duracion[] = [30, 60, 90, 120]
