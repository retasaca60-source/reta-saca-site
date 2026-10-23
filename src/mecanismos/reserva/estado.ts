// En qué va el cliente mientras arma su reserva (antes de pagar).
//
// Todo cambio pasa por `reducir`. Si algo "se borra solo" o "salta de paso",
// aquí está la causa, no en las pantallas: ellas solo piden cambios.
//
// Esto es solo lo que el cliente va eligiendo. Lo que vale de verdad (si hay
// lugar, cuánto cuesta) lo decide el servicio de datos al apartar.

import { duracionesEnLinea, type Configuracion, type DeporteId, type Duracion, type Modalidad } from '../../negocio/configuracion'

export type Paso = 1 | 2 | 3

export interface Borrador {
  /** 1 deporte · 2 horario y datos · 3 pago */
  paso: Paso
  deporte: DeporteId | null
  /** Cornhole: estándar (4 personas) o para 2 personas. */
  modalidad: Modalidad
  /** Ping Pong: 2 palas extra. */
  palasExtra: boolean
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
  return {
    paso: 1,
    deporte: null,
    modalidad: 'estandar',
    palasExtra: false,
    fecha: hoy,
    duracion: 60,
    inicio: null,
    nombre: '',
    whatsapp: '',
    aceptaReglas: false,
    aviso: null,
  }
}

export type Accion =
  | { tipo: 'elegirDeporte'; deporte: DeporteId; config: Configuracion }
  | { tipo: 'elegirModalidad'; modalidad: Modalidad }
  | { tipo: 'pedirPalas'; palasExtra: boolean }
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
      // Al cambiar de deporte se suelta la hora (otro deporte tiene otra
      // disponibilidad y otro precio) y se vuelve a la modalidad estándar sin
      // palas: son opciones de un juego, no se arrastran al otro.
      if (b.deporte === a.deporte) return b
      return { ...b, deporte: a.deporte, modalidad: 'estandar', palasExtra: false, inicio: null }
    }
    case 'elegirModalidad':
      // Misma mesa y mismo horario, otro precio: la hora elegida se queda.
      return b.deporte ? { ...b, modalidad: a.modalidad } : b
    case 'pedirPalas':
      return b.deporte ? { ...b, palasExtra: a.palasExtra } : b
    case 'irAPaso':
      if (a.paso === 2) {
        if (!b.deporte) return b
        // En línea no hay media hora: si venía con una duración que no se
        // reserva en línea, se cambia a la primera que sí.
        const duraciones = duracionesEnLinea(a.config, a.config.deportes[b.deporte])
        const duracion = duraciones.includes(b.duracion) ? b.duracion : duraciones[0]
        return { ...b, paso: 2, duracion, inicio: duracion === b.duracion ? b.inicio : null }
      }
      if (a.paso === 3) return b.inicio !== null ? { ...b, paso: 3 } : b
      return { ...b, paso: a.paso }
    // Cambiar el día o la duración cambia qué horarios hay: se suelta la hora.
    // El aviso de "alguien tomó esa mesa" era de la hora anterior: se borra también.
    case 'elegirFecha':
      return { ...b, fecha: a.fecha, inicio: null, aviso: null }
    case 'elegirDuracion':
      return { ...b, duracion: a.duracion, inicio: null, aviso: null }
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
