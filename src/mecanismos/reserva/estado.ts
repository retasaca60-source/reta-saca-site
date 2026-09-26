// En qué va la reserva: qué eligió el cliente y en qué paso está.
//
// Todo cambio pasa por `reducir`. Si algo "se borra solo" o "salta de paso",
// aquí está la causa, no en las pantallas: ellas solo piden cambios.

import { DEPORTES, type DeporteId, type Duracion, type Personas } from '../../negocio/catalogo'

export type Paso = 1 | 2 | 3 | 4

export interface Reserva {
  /** 1 deporte · 2 horario · 3 datos · 4 reserva lista */
  paso: Paso
  deporte: DeporteId | null
  personas: Personas | null
  /** Días a partir de hoy (0 = hoy). */
  dia: number
  duracion: Duracion
  /** Hora de inicio en formato 24 h. */
  hora: number | null
  nombre: string
  /** Solo dígitos, máximo 10. */
  whatsapp: string
  folio: string | null
  mesa: string | null
}

export const reservaNueva: Reserva = {
  paso: 1,
  deporte: null,
  personas: null,
  dia: 0,
  duracion: 60,
  hora: null,
  nombre: '',
  whatsapp: '',
  folio: null,
  mesa: null,
}

export type Accion =
  | { tipo: 'elegirDeporte'; deporte: DeporteId }
  | { tipo: 'elegirPersonas'; personas: Personas }
  | { tipo: 'irAPaso'; paso: Paso }
  | { tipo: 'elegirDia'; dia: number }
  | { tipo: 'elegirDuracion'; duracion: Duracion }
  | { tipo: 'elegirHora'; hora: number }
  | { tipo: 'escribirNombre'; nombre: string }
  | { tipo: 'escribirWhatsapp'; whatsapp: string }
  | { tipo: 'confirmar'; mesa: string; folio: string }
  | { tipo: 'otraReserva' }

/**
 * Popdarts cobra igual sin importar cuántos jueguen, y la versión original
 * dejaba la reserva siempre en 2 aunque se tocara "4 personas". Se conserva.
 */
function personasPara(deporte: DeporteId, pedidas: Personas | null): Personas | null {
  return deporte === 'popdarts' ? 2 : pedidas
}

export function reducir(r: Reserva, accion: Accion): Reserva {
  switch (accion.tipo) {
    case 'elegirDeporte':
      return { ...r, deporte: accion.deporte, personas: personasPara(accion.deporte, null) }
    case 'elegirPersonas':
      return r.deporte ? { ...r, personas: personasPara(r.deporte, accion.personas) } : r
    case 'irAPaso': {
      // Cornhole y Popdarts no tienen 30 min: si venía de Ping Pong con 30,
      // al llegar al horario se cambia a la primera duración que sí ofrecen.
      if (accion.paso === 2 && r.deporte && !DEPORTES[r.deporte].duraciones.includes(r.duracion)) {
        return { ...r, paso: 2, duracion: DEPORTES[r.deporte].duraciones[0], hora: null }
      }
      return { ...r, paso: accion.paso }
    }
    // Cambiar el día o la duración cambia qué horarios hay: se suelta la hora.
    case 'elegirDia':
      return { ...r, dia: accion.dia, hora: null }
    case 'elegirDuracion':
      return { ...r, duracion: accion.duracion, hora: null }
    case 'elegirHora':
      return { ...r, hora: accion.hora }
    case 'escribirNombre':
      return { ...r, nombre: accion.nombre }
    case 'escribirWhatsapp':
      return { ...r, whatsapp: accion.whatsapp.replace(/\D/g, '').slice(0, 10) }
    case 'confirmar':
      return { ...r, mesa: accion.mesa, folio: accion.folio, paso: 4 }
    case 'otraReserva':
      return reservaNueva
  }
}

/** Lo mínimo para poder confirmar: nombre de al menos 2 letras y WhatsApp de 10 dígitos. */
export function datosCompletos(r: Reserva): boolean {
  return r.nombre.trim().length > 1 && r.whatsapp.length === 10
}
