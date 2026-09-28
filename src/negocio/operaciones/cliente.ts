// Lo que hace el cliente: ver horarios, apartar, pagar y cancelar
// (RESERVAS.md §2 a §8). Funciones puras: reciben el contexto y regresan la
// reserva resultante o lanzan ErrorDeDatos. No guardan nada; eso lo hace quien
// las llama (versión simulada o real).

import { mesasLibres } from '../disponibilidad'
import { ErrorDeDatos } from '../errores'
import { iniciosPosibles } from '../horario'
import { nuevoFolio, nuevoId, nuevoToken } from '../identificadores'
import { precioDe } from '../precios'
import { estaActiva, puedeCancelarConDevolucion, repartir, type Reserva } from '../reserva'
import { instante, momentoDe } from '../tiempo'
import type { DeporteId, Duracion } from '../configuracion'
import { copia, devolverPagosEnLinea, type Contexto } from './contexto'
import type { HorarioDisponible, SolicitudDeReserva, VistaDeCobro } from './tipos'

export function horariosDisponibles(ctx: Contexto, deporte: DeporteId, fecha: string, duracion: Duracion): HorarioDisponible[] {
  return iniciosPosibles(ctx.config, fecha, duracion, momentoDe(ctx.ahora)).map((inicio) => ({
    inicio,
    libres: Math.max(0, mesasLibres(ctx.config, ctx.reservas, deporte, fecha, inicio, duracion, ctx.ahora)),
    ...precioDe(ctx.config, deporte, inicio, duracion),
  }))
}

/** Revalida todo y crea la reserva APARTADA con su precio y sus partes. */
export function apartar(ctx: Contexto, s: SolicitudDeReserva): Reserva {
  const { config, reservas, ahora } = ctx
  const d = config.deportes[s.deporte]
  const nombre = s.organizador.nombre.trim()
  const whatsapp = s.organizador.whatsapp.replace(/\D/g, '')
  if (!d || !d.duraciones.includes(s.duracion)) throw new ErrorDeDatos('datos_invalidos', 'Esa duración no existe para ese deporte.')
  if (nombre.length < 2 || whatsapp.length !== 10) throw new ErrorDeDatos('datos_invalidos', 'Falta tu nombre o tu WhatsApp de 10 dígitos.')
  const partes = d.seDivide ? s.partes : 1
  if (![1, 2, 4].includes(partes)) throw new ErrorDeDatos('datos_invalidos', 'Solo se divide entre 2 o entre 4.')
  if (!iniciosPosibles(config, s.fecha, s.duracion, momentoDe(ahora)).includes(s.inicio)) {
    throw new ErrorDeDatos('fuera_de_horario', 'Ese horario ya no se puede reservar. Elige otro.')
  }
  const maximo = config.reglas.reservasActivasPorWhatsapp
  const activas = reservas.filter((r) => r.organizador.whatsapp === whatsapp && estaActiva(r, ahora)).length
  if (activas >= maximo) {
    throw new ErrorDeDatos('limite_whatsapp', `Ese WhatsApp ya tiene ${activas} reservas activas (el máximo es ${maximo}). Para grupos más grandes, escríbenos.`)
  }
  if (mesasLibres(config, reservas, s.deporte, s.fecha, s.inicio, s.duracion, ahora) < 1) {
    throw new ErrorDeDatos('sin_lugar', 'Alguien acaba de tomar la última mesa de ese horario. Elige otro.')
  }
  const { precio, conPromo } = precioDe(config, s.deporte, s.inicio, s.duracion)
  return {
    id: nuevoId(),
    folio: nuevoFolio(),
    tokenPrivado: nuevoToken(),
    tokenCobro: nuevoToken(),
    deporte: s.deporte,
    fecha: s.fecha,
    inicio: s.inicio,
    duracion: s.duracion,
    precio,
    conPromo,
    partesElegidas: partes,
    partes: repartir(precio, partes).map((monto, i) => ({ id: nuevoId(), monto, delOrganizador: i === 0, concepto: 'reserva', pago: null })),
    organizador: { nombre, whatsapp },
    origen: 'sitio',
    estado: 'apartada',
    apartadaHasta: ahora + config.reglas.minutosDeApartado * 60_000,
    mesa: null,
    llegaronEn: null,
    cancelacion: null,
    creadaEn: new Date(ahora).toISOString(),
  }
}

/**
 * Antes de mandar a pagar: que la reserva siga viva, que las partes existan y
 * estén pendientes, y quién paga. NO alarga el apartado: antes, tocar "Pagar"
 * una y otra vez lo renovaba sin fin (medido: 54 min apartada sin pagar).
 */
export function prepararPago(r: Reserva, parteIds: string[], quienPaga: string): { nombre: string; monto: number } {
  if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'Esta reserva está cancelada.')
  const partes = r.partes.filter((p) => parteIds.includes(p.id))
  if (!partes.length || partes.length !== parteIds.length || partes.some((p) => p.pago)) {
    throw new ErrorDeDatos('datos_invalidos', 'Esa parte ya está pagada. Recarga la página.')
  }
  const nombre = quienPaga.trim()
  if (nombre.length < 2) throw new ErrorDeDatos('datos_invalidos', 'Escribe tu nombre para que recepción sepa quién pagó.')
  return { nombre, monto: partes.reduce((s, p) => s + p.monto, 0) }
}

/**
 * Llegó un pago en línea aprobado. Si el apartado se venció mientras pagaba,
 * solo se acepta si la mesa sigue libre; si no, el pago se debe devolver.
 */
export function confirmarPagoEnLinea(ctx: Contexto, r: Reserva, parteIds: string[], nombre: string): Reserva {
  const nueva = copia(r)
  if (nueva.estado === 'cancelada') {
    const rescatable =
      nueva.cancelacion?.motivo === 'apartado_vencido' &&
      mesasLibres(ctx.config, ctx.reservas, nueva.deporte, nueva.fecha, nueva.inicio, nueva.duracion, ctx.ahora, nueva.id) >= 1
    if (!rescatable) {
      throw new ErrorDeDatos('apartado_vencido', 'Se venció el tiempo para pagar y la mesa ya no está disponible. No se hizo ningún cobro.')
    }
    nueva.cancelacion = null
  }
  const en = new Date(ctx.ahora).toISOString()
  for (const p of nueva.partes) if (parteIds.includes(p.id) && !p.pago) p.pago = { medio: 'en_linea', nombre, en }
  nueva.estado = 'confirmada'
  nueva.apartadaHasta = null
  return nueva
}

/**
 * El cliente cancela desde su link. Siempre se puede antes de empezar (libera
 * la mesa para otro), pero solo se devuelve el dinero hasta N horas antes.
 */
export function cancelarComoCliente(ctx: Contexto, r: Reserva): Reserva {
  if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'Esta reserva ya estaba cancelada.')
  if (instante(r.fecha, r.inicio) <= ctx.ahora) throw new ErrorDeDatos('no_permitido', 'La reserva ya empezó. Habla con recepción.')
  const nueva = copia(r)
  if (puedeCancelarConDevolucion(r, ctx.config, ctx.ahora)) devolverPagosEnLinea(nueva)
  nueva.estado = 'cancelada'
  nueva.cancelacion = { motivo: 'cliente', en: new Date(ctx.ahora).toISOString() }
  return nueva
}

/** Un apartado cuyo plazo pasó sin pagar deja de ocupar mesa. null si no aplica. */
export function vencerApartado(r: Reserva, ahora: number): Reserva | null {
  if (r.estado !== 'apartada' || r.apartadaHasta === null || r.apartadaHasta > ahora) return null
  const nueva = copia(r)
  nueva.estado = 'cancelada'
  nueva.cancelacion = { motivo: 'apartado_vencido', en: new Date(r.apartadaHasta).toISOString() }
  return nueva
}

/** Lo que ve quien abre el link de cobro: sin WhatsApp del organizador ni link privado. */
export function vistaDeCobro(r: Reserva): VistaDeCobro {
  return {
    folio: r.folio,
    deporte: r.deporte,
    fecha: r.fecha,
    inicio: r.inicio,
    duracion: r.duracion,
    precio: r.precio,
    organizador: r.organizador.nombre,
    estado: r.estado,
    partes: r.partes.map((p) => ({
      id: p.id,
      monto: p.monto,
      pagada: Boolean(p.pago && !p.pago.devuelto),
      nombre: p.pago?.nombre ?? null,
      delOrganizador: p.delOrganizador,
    })),
  }
}
