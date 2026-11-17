// El combo (desde el 17/11/2026): media hora de cada juego, uno después del
// otro, por un solo precio ($200). El cliente escoge cuál va primero; las
// palas extra de Ping Pong se cobran aparte. Se reserva en línea y en el
// local, todos los días.
//
// Decisiones:
// - **Cada turno es una reserva normal de su juego**, amarrada a la otra
//   (`combo` en Reserva). Así el plano, sentar, la alarma, el tiempo extra y
//   la caja funcionan sin saber de combos. Se descartó una sola reserva con
//   dos juegos adentro: cada cálculo de mesas libres, cada pantalla del panel
//   y cada aviso habría tenido que aprender a leerla, y un olvido vendía una
//   mesa dos veces.
// - **El cobro va completo en el turno 1** (el primero en la hora): un solo
//   pago en Clip o en la caja, sin repartir $200 entre dos reservas. El turno
//   2 no lleva partes; solo lo que se le agregue después (tiempo extra).
// - **Las dos se mueven juntas.** Toda operación sobre un turno pasa después
//   por `seguirAlCombo`, que le lleva al otro el estado, el apartado, la
//   cancelación y el cambio de horario, y revisa que el otro juego tenga
//   lugar. Si no lo tiene, no se guarda ninguna de las dos.
// - **El turno 1 no se extiende**: termina justo cuando empieza el otro juego.
//   El tiempo extra se agrega al segundo.

import { mesasLibres } from '../disponibilidad'
import { ErrorDeDatos } from '../errores'
import { bloqueEn, cabeEnUnBloque, estaCerrado, iniciosPosibles } from '../horario'
import { nuevoFolio, nuevoId, nuevoToken } from '../identificadores'
import { precioDePalas } from '../precios'
import { type DeporteId, type Configuracion } from '../configuracion'
import { formatoDinero } from '../formato'
import { formatoHora, instante, momentoDe } from '../tiempo'
import type { Reserva } from '../reserva'
import { abrirDevolucion, copia, type Contexto } from './contexto'
import { asignarMesa } from './panel'
import { APARTADOS_SIN_PAGAR_POR_WHATSAPP } from './cliente'
import type { ComboSinReserva, HorarioDisponible, SolicitudDeCombo } from './tipos'

/** Minutos de cada juego en el combo. */
export const TURNO_DEL_COMBO = 30

export const otroJuego = (d: DeporteId): DeporteId => (d === 'pingpong' ? 'cornhole' : 'pingpong')

/** Los dos turnos de un combo que empieza a `inicio` con `primero`. */
export function turnosDelCombo(primero: DeporteId, inicio: number): [{ deporte: DeporteId; inicio: number }, { deporte: DeporteId; inicio: number }] {
  return [
    { deporte: primero, inicio },
    { deporte: otroJuego(primero), inicio: inicio + TURNO_DEL_COMBO },
  ]
}

/** El combo y, si se piden, las 2 palas extra de Ping Pong. */
export function precioDelCombo(config: Configuracion, palasExtra: boolean | undefined) {
  const palas = precioDePalas(config.deportes.pingpong, palasExtra)
  return { precio: config.combo.precio, palasExtra: palas, total: config.combo.precio + palas }
}

/** Cuántos combos caben: lo que quede libre del juego que tenga menos en su media hora. */
function combosLibres(ctx: Contexto, fecha: string, primero: DeporteId, inicio: number) {
  return Math.min(...turnosDelCombo(primero, inicio).map((t) => mesasLibres(ctx.config, ctx.reservas, t.deporte, fecha, t.inicio, TURNO_DEL_COMBO, ctx.ahora)))
}

/** Las horas que se ofrecen en línea: que quepa la hora completa y haya lugar en los dos juegos. */
export function horariosDelCombo(ctx: Contexto, fecha: string, primero: DeporteId): HorarioDisponible[] {
  if (!ctx.config.combo.activa) return []
  return iniciosPosibles(ctx.config, fecha, 60, momentoDe(ctx.ahora)).map((inicio) => ({
    inicio,
    libres: Math.max(0, combosLibres(ctx, fecha, primero, inicio)),
    precio: ctx.config.combo.precio,
    conPromo: false,
  }))
}

/**
 * Las dos reservas del combo, amarradas. El turno 1 lleva el cobro; las palas
 * extra se anotan en el turno de Ping Pong (es donde se entregan) aunque se
 * cobren con el combo.
 */
export function armarCombo(
  config: Configuracion,
  base: Omit<Reserva, 'id' | 'folio' | 'tokenPrivado' | 'tokenCobro' | 'deporte' | 'inicio' | 'duracion' | 'precio' | 'conPromo' | 'partes' | 'combo' | 'palasExtra'>,
  primero: DeporteId,
  inicio: number,
  palasExtra: boolean | undefined,
  pago: Reserva['partes'][number]['pago'],
): [Reserva, Reserva] {
  const { precio, palasExtra: palas, total } = precioDelCombo(config, palasExtra)
  const [t1, t2] = turnosDelCombo(primero, inicio)
  const id1 = nuevoId()
  const id2 = nuevoId()
  const folio = nuevoFolio()
  const turno = (id: string, con: string, t: typeof t1, n: 1 | 2): Reserva => ({
    ...structuredClone(base),
    id,
    // Un folio por fila (la base no deja repetirlo); el cliente solo ve el del turno 1.
    folio: n === 1 ? folio : `${folio}-2`,
    tokenPrivado: nuevoToken(),
    tokenCobro: nuevoToken(),
    deporte: t.deporte,
    inicio: t.inicio,
    duracion: TURNO_DEL_COMBO,
    precio: n === 1 ? precio : 0,
    conPromo: false,
    ...(palas && t.deporte === 'pingpong' ? { palasExtra: palas } : {}),
    partes: n === 1 ? [{ id: nuevoId(), monto: total, delOrganizador: true, concepto: 'reserva', pago }] : [],
    combo: { con, turno: n },
  })
  return [turno(id1, id2, t1, 1), turno(id2, id1, t2, 2)]
}

/** Revalida todo y aparta los dos turnos (en línea). Se paga completo, en el turno 1. */
export function apartarCombo(ctx: Contexto, s: SolicitudDeCombo): [Reserva, Reserva] {
  const { config, reservas, ahora } = ctx
  if (!config.combo.activa) throw new ErrorDeDatos('datos_invalidos', 'El combo ya no está disponible.')
  const nombre = s.organizador.nombre.trim()
  const whatsapp = s.organizador.whatsapp.replace(/\D/g, '')
  if (s.primero !== 'pingpong' && s.primero !== 'cornhole') throw new ErrorDeDatos('datos_invalidos', 'Elige qué juego va primero.')
  if (nombre.length < 2 || whatsapp.length !== 10) throw new ErrorDeDatos('datos_invalidos', 'Falta tu nombre o tu WhatsApp de 10 dígitos.')
  if (!iniciosPosibles(config, s.fecha, 60, momentoDe(ahora)).includes(s.inicio)) {
    throw new ErrorDeDatos('fuera_de_horario', 'Ese horario ya no se puede reservar. Elige otro.')
  }
  // El mismo freno que en una reserva normal; el combo cuenta como una.
  const sinPagar = reservas.filter(
    (r) => r.organizador.whatsapp === whatsapp && r.estado === 'apartada' && (r.apartadaHasta ?? 0) > ahora && r.combo?.turno !== 2,
  ).length
  if (sinPagar >= APARTADOS_SIN_PAGAR_POR_WHATSAPP) {
    throw new ErrorDeDatos('demasiados_intentos', `Ya tienes ${sinPagar} reservas apartadas sin pagar. Paga una, o espera unos minutos a que se liberen.`)
  }
  if (combosLibres(ctx, s.fecha, s.primero, s.inicio) < 1) {
    throw new ErrorDeDatos('sin_lugar', 'Alguien acaba de tomar el último lugar de ese horario en uno de los dos juegos. Elige otro.')
  }
  const en = new Date(ahora).toISOString()
  return armarCombo(
    config,
    {
      fecha: s.fecha,
      partesElegidas: 1,
      organizador: { nombre, whatsapp },
      origen: 'sitio',
      estado: 'apartada',
      apartadaHasta: ahora + config.reglas.minutosDeApartado * 60_000,
      mesa: null,
      llegaronEn: null,
      cancelacion: null,
      creadaEn: en,
    },
    s.primero,
    s.inicio,
    s.palasExtra,
    null,
  )
}

/** Lo que cuesta un combo que empieza AHORA en el local. */
export function cotizarCombo(ctx: Contexto, palasExtra = false) {
  return { ...precioDelCombo(ctx.config, palasExtra), conPromo: false, inicio: momentoDe(ctx.ahora).minutos }
}

/** Un combo en el mostrador: empieza ahora y se cobra al registrarlo, como cualquier grupo sin reserva. */
export function anotarComboSinReserva(ctx: Contexto, c: ComboSinReserva, quien: string): [Reserva, Reserva] {
  const { config, ahora } = ctx
  const m = momentoDe(ahora)
  if (!config.combo.activa) throw new ErrorDeDatos('datos_invalidos', 'El combo está apagado en Ajustes.')
  if (c.primero !== 'pingpong' && c.primero !== 'cornhole') throw new ErrorDeDatos('datos_invalidos', 'Elige qué juego va primero.')
  if (c.nombre.trim().length < 2) throw new ErrorDeDatos('datos_invalidos', 'Escribe un nombre para identificar al grupo.')
  const bloque = bloqueEn(config, m.fecha, m.minutos)
  if (!bloque) throw new ErrorDeDatos('fuera_de_horario', 'El local está cerrado a esta hora.')
  if (m.minutos + 2 * TURNO_DEL_COMBO > bloque.hasta) {
    throw new ErrorDeDatos('fuera_de_horario', `No alcanza la hora del combo: se cierra a las ${formatoHora(bloque.hasta)}.`)
  }
  for (const t of turnosDelCombo(c.primero, m.minutos)) {
    if (mesasLibres(config, ctx.reservas, t.deporte, m.fecha, t.inicio, TURNO_DEL_COMBO, ahora) < 1) {
      throw new ErrorDeDatos('sin_lugar', `No hay ${config.deportes[t.deporte].nombre} libre de ${formatoHora(t.inicio)} a ${formatoHora(t.inicio + TURNO_DEL_COMBO)}.`)
    }
  }
  const { total } = precioDelCombo(config, c.palasExtra)
  if (c.precioEsperado !== undefined && c.precioEsperado !== total) {
    throw new ErrorDeDatos(
      'datos_invalidos',
      `El combo cuesta ahora ${formatoDinero(total)}, no ${formatoDinero(c.precioEsperado)}: cambió el precio. No se registró nada; revisa el total y cobra otra vez.`,
    )
  }
  const nombre = c.nombre.trim()
  const en = new Date(ahora).toISOString()
  const [t1, t2] = armarCombo(
    config,
    {
      fecha: m.fecha,
      partesElegidas: 1,
      organizador: { nombre, whatsapp: (c.whatsapp ?? '').replace(/\D/g, '') },
      origen: 'mostrador',
      estado: 'confirmada',
      apartadaHasta: null,
      mesa: null,
      // Ya están en el local: el segundo turno no es "por llegar".
      llegaronEn: en,
      cancelacion: null,
      creadaEn: en,
    },
    c.primero,
    m.minutos,
    c.palasExtra,
    { medio: c.medio, nombre, en, marcadoPor: quien },
  )
  return [c.mesa ? asignarMesa(ctx, t1, c.mesa) : t1, t2]
}

/**
 * Después de cualquier operación sobre un turno: lo que el otro turno tiene
 * que llevarse (estado, apartado, cancelación, cambio de horario), o null si
 * no le toca nada. Lanza si el otro juego no tiene lugar en su horario nuevo:
 * así no se guarda ninguna de las dos.
 *
 * `ctx` tiene que traer las reservas del día al que queda el combo.
 */
export function seguirAlCombo(ctx: Contexto, antes: Reserva, nueva: Reserva, otra: Reserva): Reserva | null {
  if (!antes.combo || otra.id !== antes.combo.con) return null
  const s = copia(otra)
  let cambio = false

  // Se mueve: el otro turno conserva su lugar en la hora (antes o después).
  if (nueva.fecha !== antes.fecha || nueva.inicio !== antes.inicio) {
    s.fecha = nueva.fecha
    s.inicio = nueva.inicio + (otra.inicio - antes.inicio)
    s.mesa = null
    s.llegaronEn = null
    cambio = true
  }
  if (nueva.estado !== antes.estado || nueva.apartadaHasta !== antes.apartadaHasta) {
    s.estado = nueva.estado
    s.apartadaHasta = nueva.apartadaHasta
    cambio = true
  }
  if (JSON.stringify(nueva.cancelacion) !== JSON.stringify(antes.cancelacion)) {
    s.cancelacion = nueva.cancelacion ? { ...nueva.cancelacion } : null
    // Si se cancela desde el turno 2, el dinero está en el 1: ahí se abre la devolución.
    if (s.estado === 'cancelada' && otra.estado !== 'cancelada') abrirDevolucion(s)
    // Si revive (pago que llegó tarde), la mesa de antes ya se soltó.
    if (!s.cancelacion) s.mesa = null
    cambio = true
  }
  if (!cambio) return null

  // El otro juego tiene que tener lugar donde queda: al moverse o al revivir.
  const seMovio = s.inicio !== otra.inicio || s.fecha !== otra.fecha
  if (s.estado !== 'cancelada' && (seMovio || otra.estado === 'cancelada')) {
    const nombre = ctx.config.deportes[s.deporte].nombre
    if (estaCerrado(ctx.config, s.fecha) || !cabeEnUnBloque(ctx.config, s.fecha, s.inicio, s.duracion)) {
      throw new ErrorDeDatos('fuera_de_horario', `El turno de ${nombre} del combo quedaría fuera del horario del local.`)
    }
    if (seMovio && instante(s.fecha, s.inicio + s.duracion) <= ctx.ahora) {
      throw new ErrorDeDatos('fuera_de_horario', `El turno de ${nombre} del combo ya habría pasado.`)
    }
    if (mesasLibres(ctx.config, ctx.reservas, s.deporte, s.fecha, s.inicio, s.duracion, ctx.ahora, s.id) < 1) {
      throw new ErrorDeDatos(otra.estado === 'cancelada' ? 'apartado_vencido' : 'sin_lugar', `No hay ${nombre} libre para el otro turno del combo (${formatoHora(s.inicio)}).`)
    }
  }
  return s
}
