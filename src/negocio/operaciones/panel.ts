// Lo que hace recepción en el panel (RESERVAS.md §7 y §10). Funciones puras:
// reciben el contexto y regresan la reserva resultante o lanzan ErrorDeDatos.
// Quién está haciendo la acción (`quien`) lo pone la versión de datos a partir
// de la sesión, nunca la pantalla.

import type { Duracion } from '../configuracion'
import { mesasLibres } from '../disponibilidad'
import { ErrorDeDatos } from '../errores'
import { bloqueEn, cabeEnUnBloque, estaCerrado } from '../horario'
import { nuevoFolio, nuevoId, nuevoToken } from '../identificadores'
import { precioDe, precioDeExtension, precioSiExiste } from '../precios'
import { fin, ocupaMesa, puedeLiberarPorRetraso, total, type MedioDePago, type Reserva } from '../reserva'
import { formatoHora, momentoDe } from '../tiempo'
import { abrirDevolucion, copia, type Contexto } from './contexto'
import type { ClienteSinReserva, PagoDelDia } from './tipos'

/**
 * Precio para un grupo que llega sin reserva: cuenta la media hora en que
 * empiezan (llegan a las 5:10 → entran en la promo de las 5:00; pendiente de
 * confirmar con Hugo). Exportado para que la caja muestre el total ANTES de
 * cobrar con la misma regla con que se cobra.
 */
export function precioSinReserva(config: Contexto['config'], deporte: ClienteSinReserva['deporte'], minutoDeLlegada: number, duracion: Duracion) {
  const paso = config.reglas.pasoDeInicio
  return precioDe(config, deporte, Math.floor(minutoDeLlegada / paso) * paso, duracion)
}

/**
 * Un grupo que llega al mostrador sin reserva: empieza AHORA y se COBRA AL
 * REGISTRARLO (como caja: nadie se va sin pagar). El tiempo extra se cobra
 * después, con "Cobrar". `quien` es quien atiende la caja.
 */
export function anotarSinReserva(ctx: Contexto, c: ClienteSinReserva, quien: string): Reserva {
  const { config, reservas, ahora } = ctx
  const m = momentoDe(ahora)
  const d = config.deportes[c.deporte]
  if (!d.duraciones.includes(c.duracion)) throw new ErrorDeDatos('datos_invalidos', 'Esa duración no existe para ese deporte.')
  if (c.nombre.trim().length < 2) throw new ErrorDeDatos('datos_invalidos', 'Escribe un nombre para identificar al grupo.')
  const bloque = bloqueEn(config, m.fecha, m.minutos)
  if (!bloque) throw new ErrorDeDatos('fuera_de_horario', 'El local está cerrado a esta hora.')
  if (m.minutos + c.duracion > bloque.hasta) {
    throw new ErrorDeDatos('fuera_de_horario', `No alcanza: se cierra a las ${formatoHora(bloque.hasta)}. Elige menos tiempo.`)
  }
  if (mesasLibres(config, reservas, c.deporte, m.fecha, m.minutos, c.duracion, ahora) < 1) {
    throw new ErrorDeDatos('sin_lugar', `No hay ${d.nombre} libre durante todo ese tiempo.`)
  }
  const { precio, conPromo } = precioSinReserva(config, c.deporte, m.minutos, c.duracion)
  const nombre = c.nombre.trim()
  const r: Reserva = {
    id: nuevoId(),
    folio: nuevoFolio(),
    tokenPrivado: nuevoToken(),
    tokenCobro: nuevoToken(),
    deporte: c.deporte,
    fecha: m.fecha,
    inicio: m.minutos,
    duracion: c.duracion,
    precio,
    conPromo,
    partesElegidas: 1,
    partes: [
      {
        id: nuevoId(),
        monto: precio,
        delOrganizador: true,
        concepto: 'reserva',
        pago: { medio: c.medio, nombre, en: new Date(ahora).toISOString(), marcadoPor: quien },
      },
    ],
    organizador: { nombre, whatsapp: (c.whatsapp ?? '').replace(/\D/g, '') },
    origen: 'mostrador',
    estado: 'confirmada',
    apartadaHasta: null,
    mesa: null,
    llegaronEn: new Date(ahora).toISOString(),
    cancelacion: null,
    creadaEn: new Date(ahora).toISOString(),
  }
  return c.mesa ? asignarMesa(ctx, r, c.mesa) : r
}

/**
 * Sienta al grupo en una mesa concreta ("CH 3"): que exista, funcione y no la
 * tenga otro grupo a esa hora. Marca que llegaron. `null` quita la mesa.
 */
export function asignarMesa(ctx: Contexto, r: Reserva, mesa: string | null): Reserva {
  const nueva = copia(r)
  if (mesa === null) {
    nueva.mesa = null
    return nueva
  }
  const d = ctx.config.deportes[r.deporte]
  const n = Number(mesa.replace(d.clave, '').trim())
  if (!Number.isInteger(n) || n < 1 || n > d.mesas) throw new ErrorDeDatos('datos_invalidos', `${mesa} no existe.`)
  if (d.fueraDeServicio.includes(n)) throw new ErrorDeDatos('no_permitido', `${mesa} está fuera de servicio.`)
  const etiqueta = `${d.clave} ${n}`
  const otra = quienTieneLaMesa(ctx, r, etiqueta, r.inicio, fin(r))
  if (otra) throw new ErrorDeDatos('no_permitido', `${etiqueta} ya la tiene ${otra.organizador.nombre} a esa hora.`)
  nueva.mesa = etiqueta
  nueva.llegaronEn ??= new Date(ctx.ahora).toISOString()
  return nueva
}

/** Una mesa asignada también está ocupada durante un apartado vigente. */
function quienTieneLaMesa(
  ctx: Contexto,
  r: Reserva,
  mesa: string,
  desde: number,
  hasta: number,
): Reserva | undefined {
  return ctx.reservas.find(
    (x) =>
      x.id !== r.id &&
      ocupaMesa(x, ctx.ahora) &&
      x.mesa === mesa &&
      x.fecha === r.fecha &&
      x.inicio < hasta &&
      fin(x) > desde,
  )
}

/** Pago en el local (efectivo o tarjeta). Queda quién lo marcó. */
export function marcarPago(
  ctx: Contexto,
  r: Reserva,
  parteIds: string[],
  medio: Exclude<MedioDePago, 'en_linea'>,
  nombre: string | undefined,
  quien: string,
): Reserva {
  if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'La reserva está cancelada.')
    // Una asignación guardada por una versión anterior podría estar duplicada.
  // Se rechaza antes de registrar el cobro para que recepción cambie la mesa.
  if (r.estado === 'apartada' && r.mesa) {
    const otra = quienTieneLaMesa(ctx, r, r.mesa, r.inicio, fin(r))

    if (otra) {
      throw new ErrorDeDatos(
        'no_permitido',
        `${r.mesa} ya la tiene ${otra.organizador.nombre} a esa hora. Cambia la mesa antes de registrar el pago.`,
      )
    }
  }
  const nueva = copia(r)
  const partes = nueva.partes.filter((p) => parteIds.includes(p.id) && !p.pago)
  if (!partes.length) throw new ErrorDeDatos('datos_invalidos', 'Esas partes ya estaban pagadas.')
  const en = new Date(ctx.ahora).toISOString()
  for (const p of partes) p.pago = { medio, nombre: nombre?.trim() || r.organizador.nombre, en, marcadoPor: quien }
  if (nueva.estado === 'apartada') {
    nueva.estado = 'confirmada'
    nueva.apartadaHasta = null
  }
  return nueva
}

/**
 * Tiempo extra: que alcance antes del cierre, que haya mesa libre en el
 * inventario Y que la mesa donde ya están sentados no la tenga otro grupo en
 * ese tiempo. Antes solo se revisaba el inventario: con PP 1 asignada a otro
 * grupo de 8 a 9, un grupo de 7 a 8 en PP 1 se extendía igual y quedaban dos
 * grupos en la misma mesa. Se cobra en el local.
 */
export function extender(ctx: Contexto, r: Reserva, minutos: Duracion): Reserva {
  if (r.estado !== 'confirmada') throw new ErrorDeDatos('no_permitido', 'Solo se extienden reservas confirmadas.')
  const duracion = r.duracion + minutos
  if (!cabeEnUnBloque(ctx.config, r.fecha, r.inicio, duracion)) throw new ErrorDeDatos('fuera_de_horario', 'No alcanza antes del cierre.')
  if (mesasLibres(ctx.config, ctx.reservas, r.deporte, r.fecha, r.inicio, duracion, ctx.ahora, r.id) < 1) {
    throw new ErrorDeDatos('sin_lugar', 'No hay mesa libre para ese tiempo extra.')
  }
  const siguiente = r.mesa ? quienTieneLaMesa(ctx, r, r.mesa, fin(r), r.inicio + duracion) : undefined
  if (siguiente) {
    throw new ErrorDeDatos(
      'no_permitido',
      `${r.mesa} la tiene ${siguiente.organizador.nombre} desde las ${formatoHora(siguiente.inicio)}. Para extender, primero cámbialos a otra mesa libre.`,
    )
  }
  const nueva = copia(r)
  nueva.partes.push({ id: nuevoId(), monto: precioDeExtension(ctx.config, r.deporte, r.duracion, minutos), delOrganizador: true, concepto: 'extension', pago: null })
  nueva.duracion = duracion
  return nueva
}

/**
 * Mueve la reserva, misma duración. Si el horario nuevo cuesta más (se pierde
 * la promo), la diferencia queda por cobrar; si cuesta menos, se queda como
 * estaba (pendiente de confirmar con Hugo). Se compara contra lo que YA se
 * debe (total), no contra el precio original: si no, cada cambio volvía a
 * cobrar la misma diferencia.
 */
export function cambiarHorario(ctx: Contexto, r: Reserva, fecha: string, inicio: number): Reserva {
  if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'La reserva está cancelada.')
  if (estaCerrado(ctx.config, fecha) || !cabeEnUnBloque(ctx.config, fecha, inicio, r.duracion)) {
    throw new ErrorDeDatos('fuera_de_horario', 'Ese horario está fuera del horario del local.')
  }
  if (mesasLibres(ctx.config, ctx.reservas, r.deporte, fecha, inicio, r.duracion, ctx.ahora, r.id) < 1) {
    throw new ErrorDeDatos('sin_lugar', 'No hay mesa libre en ese horario.')
  }
  const nueva = copia(r)
  const nuevo = precioSiExiste(ctx.config, r.deporte, inicio, r.duracion)
  if (nuevo) {
    const diferencia = nuevo.precio - total(r)
    if (diferencia > 0) nueva.partes.push({ id: nuevoId(), monto: diferencia, delOrganizador: true, concepto: 'cambio', pago: null })
    // La etiqueta "Promo" sigue al horario nuevo: si se sale de la promo, ya no la lleva.
    nueva.conPromo = nuevo.conPromo
  }
  nueva.fecha = fecha
  nueva.inicio = inicio
  nueva.mesa = null
  nueva.llegaronEn = null
  return nueva
}

/** Cancela el negocio. Lo pagado en línea queda por devolver, por transferencia. */
export function cancelarComoNegocio(ctx: Contexto, r: Reserva, quien: string): Reserva {
  if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'Ya estaba cancelada.')
  const nueva = copia(r)
  abrirDevolucion(nueva)
  nueva.estado = 'cancelada'
  nueva.cancelacion = { motivo: 'negocio', en: new Date(ctx.ahora).toISOString(), por: quien }
  return nueva
}

/**
 * El negocio resolvió la devolución de una cancelación: la transfirió desde su
 * banco, o decidió que no hay. Queda quién lo marcó y cuándo.
 */
export function resolverDevolucion(ctx: Contexto, r: Reserva, decision: 'transferida' | 'sin_devolucion', quien: string): Reserva {
  if (r.devolucion?.estado !== 'por_revisar') throw new ErrorDeDatos('no_permitido', 'Esta reserva no tiene una devolución por revisar.')
  const nueva = copia(r)
  // Lo transferido deja de contar como cobrado, en la reserva y en la caja.
  // Solo en una cancelada: en una vigente lo devuelto es un pago que llegó de
  // más (sin parte), y los pagos que sí cuentan se quedan.
  if (decision === 'transferida' && r.estado === 'cancelada') {
    for (const p of nueva.partes) if (p.pago?.medio === 'en_linea') p.pago.devuelto = true
  }
  nueva.devolucion = { ...r.devolucion, estado: decision, por: quien, en: new Date(ctx.ahora).toISOString() }
  return nueva
}

/** Pasada la tolerancia sin llegar: se libera la mesa, sin devolución. */
export function liberarPorRetraso(ctx: Contexto, r: Reserva, quien: string): Reserva {
  if (!puedeLiberarPorRetraso(r, ctx.config, ctx.ahora)) {
    throw new ErrorDeDatos('no_permitido', `Todavía no pasan los ${ctx.config.reglas.minutosDeTolerancia} minutos de tolerancia, o ya llegaron.`)
  }
  const nueva = copia(r)
  nueva.estado = 'cancelada'
  nueva.cancelacion = { motivo: 'no_llego', en: new Date(ctx.ahora).toISOString(), por: quien }
  return nueva
}

/** Pagos HECHOS ese día (fecha de Sonora del pago), para el cierre de caja. */
export function pagosDelDia(reservas: readonly Reserva[], fecha: string): PagoDelDia[] {
  return reservas
    .flatMap((r) =>
      r.partes
        .filter((p) => p.pago && momentoDe(Date.parse(p.pago.en)).fecha === fecha)
        .map((p) => ({
          reservaId: r.id,
          folio: r.folio,
          deporte: r.deporte,
          parteId: p.id,
          monto: p.monto,
          medio: p.pago!.medio,
          nombre: p.pago!.nombre,
          en: p.pago!.en,
          marcadoPor: p.pago!.marcadoPor,
          devuelto: Boolean(p.pago!.devuelto),
        })),
    )
    .sort((a, b) => a.en.localeCompare(b.en))
}
