// Qué días y a qué horas se puede reservar (RESERVAS.md, sección 2).

import type { Configuracion, Duracion } from './configuracion'
import { diaDeLaSemana, esFechaValida, sumarDias, type Momento } from './tiempo'

export interface DiaReservable {
  fecha: string
  cerrado: boolean
}

/** Hoy y los siguientes N días (ventana móvil). Los cerrados vienen marcados, no se esconden. */
export function diasReservables(config: Configuracion, ahora: Momento): DiaReservable[] {
  return Array.from({ length: config.reglas.diasDeAnticipacion + 1 }, (_, i) => {
    const fecha = sumarDias(ahora.fecha, i)
    return { fecha, cerrado: estaCerrado(config, fecha) }
  })
}

export function estaCerrado(config: Configuracion, fecha: string): boolean {
  return config.diasCerrados.includes(fecha) || (config.horario[diaDeLaSemana(fecha)] ?? []).length === 0
}

export function dentroDeLaVentana(config: Configuracion, fecha: string, ahora: Momento): boolean {
  return fecha >= ahora.fecha && fecha <= sumarDias(ahora.fecha, config.reglas.diasDeAnticipacion)
}

/**
 * Horas de inicio que se ofrecen para una fecha y duración:
 * - cada `pasoDeInicio` minutos dentro de cada bloque abierto;
 * - la reserva tiene que TERMINAR antes del cierre de su bloque (no se vende
 *   1 hora si faltan 30 minutos para cerrar) y nunca cruza de un bloque a otro;
 * - para hoy, solo las que empiezan al menos `minutosDeCorte` después de ahora.
 */
export function iniciosPosibles(config: Configuracion, fecha: string, duracion: Duracion, ahora: Momento): number[] {
  // Una fecha que no existe ("2026-09-31") cae dentro de la ventana al
  // compararla como texto: se descarta antes.
  if (!esFechaValida(fecha) || estaCerrado(config, fecha) || !dentroDeLaVentana(config, fecha, ahora)) return []
  const paso = config.reglas.pasoDeInicio
  const desdeHoy = fecha === ahora.fecha ? ahora.minutos + config.reglas.minutosDeCorte : -Infinity
  const inicios: number[] = []
  for (const b of config.horario[diaDeLaSemana(fecha)] ?? []) {
    for (let t = b.desde; t + duracion <= b.hasta; t += paso) {
      if (t >= desdeHoy) inicios.push(t)
    }
  }
  return inicios
}

/** El bloque abierto en ese minuto, o null si el local está cerrado a esa hora. */
export function bloqueEn(config: Configuracion, fecha: string, minuto: number) {
  if (estaCerrado(config, fecha)) return null
  return (config.horario[diaDeLaSemana(fecha)] ?? []).find((b) => minuto >= b.desde && minuto < b.hasta) ?? null
}

/** ¿Cabe una reserva de [inicio, inicio+duración) completa en algún bloque de ese día? Para el panel. */
export function cabeEnUnBloque(config: Configuracion, fecha: string, inicio: number, duracion: number): boolean {
  return (config.horario[diaDeLaSemana(fecha)] ?? []).some((b) => inicio >= b.desde && inicio + duracion <= b.hasta)
}
