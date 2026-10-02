// Cambios de configuración del dueño: que sean válidos y qué reservas futuras
// chocarían. Nunca se cancela nada sola: se le avisa a Hugo (RESERVAS.md §10).

import { mesasEnServicio, ORDEN_DEPORTES, type Configuracion } from '../configuracion'
import { ocupadasEn } from '../disponibilidad'
import { ErrorDeDatos } from '../errores'
import { cabeEnUnBloque, estaCerrado } from '../horario'
import { fin, ocupaMesa, type Reserva } from '../reserva'
import { esFechaValida, momentoDe } from '../tiempo'
import type { Conflicto } from './tipos'

const DURACIONES: readonly number[] = [30, 60, 90, 120]
const DIA = 24 * 60

/**
 * Rangos de cada regla. Antes no se revisaban: un paso de inicio de 0 dejaba
 * el cálculo de horarios dando vueltas sin fin, y un apartado de 0 minutos
 * vencía en el mismo instante en que se creaba (nadie alcanzaba a pagar).
 */
export const RANGOS_DE_REGLAS = {
  diasDeAnticipacion: { min: 0, max: 60 },
  minutosDeCorte: { min: 0, max: 240 },
  pasoDeInicio: { min: 5, max: 120 },
  minutosDeApartado: { min: 3, max: 60 },
  minutosDeTolerancia: { min: 0, max: 120 },
} as const

const NOMBRE_DE_REGLA: Record<keyof typeof RANGOS_DE_REGLAS, string> = {
  diasDeAnticipacion: 'Días que se puede reservar hacia adelante',
  minutosDeCorte: 'Minutos de corte para hoy',
  pasoDeInicio: 'Cada cuántos minutos se puede empezar',
  minutosDeApartado: 'Minutos que se aparta la mesa',
  minutosDeTolerancia: 'Minutos de tolerancia',
}

const mal = (mensaje: string) => new ErrorDeDatos('datos_invalidos', mensaje)
const entero = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * Revisa la configuración completa, campo por campo. Lo que llega puede venir
 * de cualquiera con la sesión del dueño o, en la demostración, de lo que otra
 * versión dejó guardado en el navegador: por eso se revisa también la forma,
 * no solo los valores.
 */
export function validarConfiguracion(c: Configuracion): void {
  const x = c as unknown
  if (!esObjeto(x) || !esObjeto(x.deportes) || !esObjeto(x.horario) || !esObjeto(x.promo) || !esObjeto(x.reglas)) {
    throw mal('La configuración está incompleta.')
  }

  for (const id of ORDEN_DEPORTES) {
    const d = c.deportes[id] as unknown
    if (!esObjeto(d)) throw mal('Falta un deporte en la configuración.')
    const nombre = typeof d.nombre === 'string' && d.nombre.trim() ? d.nombre : id
    if (typeof d.nombre !== 'string' || !d.nombre.trim() || typeof d.clave !== 'string' || !d.clave.trim()) throw mal(`Falta el nombre o la clave de ${nombre}.`)
    if (!entero(d.mesas, 0, 50)) throw mal(`Número de mesas de ${nombre} inválido.`)
    if (!Array.isArray(d.fueraDeServicio) || !d.fueraDeServicio.every((n) => entero(n, 1, 50))) throw mal(`Mesas fuera de servicio de ${nombre} inválidas.`)
    if (typeof d.seDivide !== 'boolean' || !entero(d.avisarDesde, 0, 50)) throw mal(`Reglas de ${nombre} inválidas.`)

    const duraciones = d.duraciones as unknown
    if (!Array.isArray(duraciones) || !duraciones.length || !duraciones.every((m) => DURACIONES.includes(m)) || new Set(duraciones).size !== duraciones.length) {
      throw mal(`Las duraciones de ${nombre} no son válidas.`)
    }
    if (!esObjeto(d.precios)) throw mal(`Faltan los precios de ${nombre}.`)
    const precios = d.precios as Record<number, unknown>
    // Que ninguna parte de un pago dividido entre 4 quede en $0.
    const minimo = d.seDivide ? 4 : 1
    let anterior: { minutos: number; precio: number } | null = null
    for (const minutos of [...(duraciones as number[])].sort((a, b) => a - b)) {
      const precio = precios[minutos]
      if (!entero(precio, minimo, 100_000)) throw mal(`Falta el precio de ${nombre} de ${minutos} min.`)
      // Más tiempo nunca cuesta lo mismo o menos: si 90 min costaba menos que
      // 60, extender 30 min dejaba una parte NEGATIVA y bajaba lo que se debía.
      if (anterior && precio <= anterior.precio) {
        throw mal(`${nombre}: ${minutos} min tiene que costar más que ${anterior.minutos} min.`)
      }
      anterior = { minutos, precio }
    }
    if (d.precioPromo !== null && !entero(d.precioPromo, minimo, 100_000)) throw mal(`Precio de promo de ${nombre} inválido.`)
  }

  for (let dia = 0; dia < 7; dia++) {
    const bloques = c.horario[dia] as unknown
    if (bloques === undefined) continue
    if (!Array.isArray(bloques) || !bloques.every((b) => esObjeto(b) && entero(b.desde, 0, DIA) && entero(b.hasta, 0, DIA))) {
      throw mal('Un horario no es válido.')
    }
    const orden = [...(bloques as { desde: number; hasta: number }[])].sort((a, b) => a.desde - b.desde)
    for (let i = 0; i < orden.length; i++) {
      if (!(orden[i].desde < orden[i].hasta)) throw mal('Un horario cierra antes de abrir.')
      // Dos bloques que se enciman repetían cada hora en la lista del cliente
      // (12 botones con 6 horas distintas).
      if (i > 0 && orden[i].desde < orden[i - 1].hasta) throw mal('Hay dos horarios que se enciman el mismo día. Únelos en uno.')
    }
  }

  if (!Array.isArray(c.diasCerrados) || !c.diasCerrados.every(esFechaValida)) throw mal('Hay un día cerrado con fecha inválida.')

  const p = c.promo as unknown as Record<string, unknown>
  if (typeof p.activa !== 'boolean' || !DURACIONES.includes(p.duracion as number)) throw mal('La promo no es válida.')
  if (!Array.isArray(p.inicios) || !p.inicios.every((t) => entero(t, 0, DIA)) || new Set(p.inicios).size !== p.inicios.length) {
    throw mal('Las horas de la promo no son válidas.')
  }

  for (const llave of Object.keys(RANGOS_DE_REGLAS) as (keyof typeof RANGOS_DE_REGLAS)[]) {
    const { min, max } = RANGOS_DE_REGLAS[llave]
    if (!entero((c.reglas as unknown as Record<string, unknown>)[llave], min, max)) throw mal(`${NOMBRE_DE_REGLA[llave]}: tiene que ser un número entero de ${min} a ${max}.`)
  }

  if (typeof c.whatsappNegocio !== 'string' || !/^(\d{10})?$/.test(c.whatsappNegocio)) throw mal('El WhatsApp del negocio son 10 dígitos.')
}

/**
 * Con la configuración nueva, ¿qué reservas que todavía no terminan se
 * quedarían sin mesa, fuera de horario o en una mesa que ya no existe?
 *
 * Cuenta todo lo que ocupa mesa: también los apartados vigentes, que siguen
 * dentro de su tiempo para pagar. Antes solo se partía de las confirmadas, y
 * se podía cerrar un día con un apartado a medio pagar sin que nadie se
 * enterara. `reservas` tiene que traer TODAS las futuras, no una ventana.
 */
export function conflictosCon(config: Configuracion, reservas: readonly Reserva[], ahoraMs: number): Conflicto[] {
  const ahora = momentoDe(ahoraMs)
  const vistos = new Set<string>()
  const conflictos: Conflicto[] = []
  const vigente = (r: Reserva) => ocupaMesa(r, ahoraMs) && (r.fecha > ahora.fecha || (r.fecha === ahora.fecha && fin(r) > ahora.minutos))

  for (const r of reservas) {
    if (!vigente(r)) continue
    const d = config.deportes[r.deporte]
    const llave = `${r.deporte}|${r.fecha}|${r.inicio}`
    if (!vistos.has(llave)) {
      const mesas = estaCerrado(config, r.fecha) || !cabeEnUnBloque(config, r.fecha, r.inicio, r.duracion) ? 0 : mesasEnServicio(d)
      const ocupadas = ocupadasEn(reservas, r.deporte, r.fecha, r.inicio, r.duracion, ahoraMs)
      if (ocupadas > mesas) {
        vistos.add(llave)
        conflictos.push({ deporte: r.deporte, fecha: r.fecha, inicio: r.inicio, reservas: ocupadas, mesas })
      }
    }
    // Contar mesas no basta: quitar PP 1 con otras libres no da faltante, pero
    // el grupo que ya estaba sentado en PP 1 se queda con una mesa que no hay.
    if (r.mesa) {
      const n = Number(r.mesa.replace(d.clave, '').trim())
      if (!Number.isInteger(n) || n < 1 || n > d.mesas || d.fueraDeServicio.includes(n)) {
        conflictos.push({ deporte: r.deporte, fecha: r.fecha, inicio: r.inicio, reservas: 1, mesas: mesasEnServicio(d), mesa: r.mesa, nombre: r.organizador.nombre })
      }
    }
  }
  return conflictos
}
