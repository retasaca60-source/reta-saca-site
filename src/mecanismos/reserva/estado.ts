// En qué va el cliente mientras arma su reserva (antes de pagar).
//
// Todo cambio pasa por `reducir`. Si algo "se borra solo" o "salta de paso",
// aquí está la causa, no en las pantallas: ellas solo piden cambios.
//
// Esto es solo lo que el cliente va eligiendo. Lo que vale de verdad (si hay
// lugar, cuánto cuesta) lo decide el servicio de datos al apartar.

import type { Configuracion, DeporteId, Duracion, Partes } from '../../negocio/configuracion'

export type Paso = 1 | 2 | 3

export interface Borrador {
  /** 1 deporte y cómo pagan · 2 horario · 3 datos y pago */
  paso: Paso
  deporte: DeporteId | null
  partes: Partes | null
  fecha: string
  duracion: Duracion
  /** Minutos desde medianoche. */
  inicio: number | null
  nombre: string
  /** Solo dígitos, máximo 10. */
  whatsapp: string
  aceptaReglas: boolean
  /** Por qué se soltó la hora, para decírselo al cliente en el paso 2. */
  aviso: string | null
}

export function borradorNuevo(hoy: string): Borrador {
  return { paso: 1, deporte: null, partes: null, fecha: hoy, duracion: 60, inicio: null, nombre: '', whatsapp: '', aceptaReglas: false, aviso: null }
}

export type Accion =
  | { tipo: 'elegirDeporte'; deporte: DeporteId; config: Configuracion }
  | { tipo: 'elegirPartes'; partes: Partes }
  | { tipo: 'irAPaso'; paso: Paso; config: Configuracion }
  | { tipo: 'elegirFecha'; fecha: string }
  | { tipo: 'elegirDuracion'; duracion: Duracion }
  | { tipo: 'elegirHora'; inicio: number }
  /** La disponibilidad ya no incluye la hora elegida (se llenó o pasó el corte). */
  | { tipo: 'soltarHora'; aviso?: string }
  | { tipo: 'escribirNombre'; nombre: string }
  | { tipo: 'escribirWhatsapp'; whatsapp: string }
  | { tipo: 'aceptarReglas'; acepta: boolean }
  | { tipo: 'empezarDeNuevo'; hoy: string }

export function reducir(b: Borrador, a: Accion): Borrador {
  switch (a.tipo) {
    case 'elegirDeporte': {
      // Popdarts se paga completo: no hay nada que elegir. Al cambiar de deporte
      // se suelta la hora: otro deporte tiene otra disponibilidad y otro precio.
      const seDivide = a.config.deportes[a.deporte].seDivide
      return { ...b, deporte: a.deporte, partes: seDivide ? null : 1, inicio: b.deporte === a.deporte ? b.inicio : null }
    }
    case 'elegirPartes':
      return b.deporte ? { ...b, partes: a.partes } : b
    case 'irAPaso':
      if (a.paso === 2) {
        if (!b.deporte || !b.partes) return b
        // Cornhole y Popdarts no tienen 30 min: si venía con 30, se cambia a la
        // primera duración que sí ofrecen.
        const duraciones = a.config.deportes[b.deporte].duraciones
        const duracion = duraciones.includes(b.duracion) ? b.duracion : duraciones[0]
        return { ...b, paso: 2, duracion, inicio: duracion === b.duracion ? b.inicio : null }
      }
      if (a.paso === 3) return b.inicio !== null ? { ...b, paso: 3 } : b
      return { ...b, paso: a.paso }
    // Cambiar el día o la duración cambia qué horarios hay: se suelta la hora.
    case 'elegirFecha':
      return { ...b, fecha: a.fecha, inicio: null }
    case 'elegirDuracion':
      return { ...b, duracion: a.duracion, inicio: null }
    case 'elegirHora':
      return { ...b, inicio: a.inicio, aviso: null }
    case 'soltarHora':
      return { ...b, inicio: null, paso: b.paso === 3 ? 2 : b.paso, aviso: a.aviso ?? b.aviso }
    case 'escribirNombre':
      return { ...b, nombre: a.nombre }
    case 'escribirWhatsapp':
      return { ...b, whatsapp: a.whatsapp.replace(/\D/g, '').slice(0, 10) }
    case 'aceptarReglas':
      return { ...b, aceptaReglas: a.acepta }
    case 'empezarDeNuevo':
      return borradorNuevo(a.hoy)
  }
}

/** Lo mínimo para ir a pagar: nombre de 2 letras, WhatsApp de 10 dígitos y reglas aceptadas. */
export function datosCompletos(b: Borrador): boolean {
  return b.nombre.trim().length > 1 && b.whatsapp.length === 10 && b.aceptaReglas
}
