// Cambios de configuración del dueño: que sean válidos y qué reservas futuras
// chocarían. Nunca se cancela nada sola: se le avisa a Hugo (RESERVAS.md §10).

import { mesasEnServicio, ORDEN_DEPORTES, type Configuracion } from '../configuracion'
import { ocupadasEn } from '../disponibilidad'
import { ErrorDeDatos } from '../errores'
import { cabeEnUnBloque, estaCerrado } from '../horario'
import type { Reserva } from '../reserva'
import { momentoDe } from '../tiempo'
import type { Conflicto } from './tipos'

export function validarConfiguracion(c: Configuracion): void {
  for (const id of ORDEN_DEPORTES) {
    const d = c.deportes[id]
    if (!Number.isInteger(d.mesas) || d.mesas < 0 || d.mesas > 50) throw new ErrorDeDatos('datos_invalidos', `Número de mesas de ${d.nombre} inválido.`)
    for (const dur of d.duraciones) {
      const p = d.precios[dur]
      if (p === undefined || !Number.isInteger(p) || p <= 0) throw new ErrorDeDatos('datos_invalidos', `Falta el precio de ${d.nombre} de ${dur} min.`)
    }
    if (d.precioPromo !== null && (!Number.isInteger(d.precioPromo) || d.precioPromo <= 0)) {
      throw new ErrorDeDatos('datos_invalidos', `Precio de promo de ${d.nombre} inválido.`)
    }
  }
  for (const bloques of Object.values(c.horario)) {
    for (const b of bloques) if (!(b.desde < b.hasta)) throw new ErrorDeDatos('datos_invalidos', 'Un horario cierra antes de abrir.')
  }
}

/** Con la configuración nueva, ¿qué reservas futuras se quedarían sin mesa o fuera de horario? */
export function conflictosCon(config: Configuracion, reservas: readonly Reserva[], ahoraMs: number): Conflicto[] {
  const hoy = momentoDe(ahoraMs).fecha
  const vistos = new Set<string>()
  const conflictos: Conflicto[] = []
  for (const r of reservas) {
    if (r.estado !== 'confirmada' || r.fecha < hoy) continue
    const llave = `${r.deporte}|${r.fecha}|${r.inicio}`
    if (vistos.has(llave)) continue
    const mesas = estaCerrado(config, r.fecha) || !cabeEnUnBloque(config, r.fecha, r.inicio, r.duracion) ? 0 : mesasEnServicio(config.deportes[r.deporte])
    const ocupadas = ocupadasEn(reservas, r.deporte, r.fecha, r.inicio, r.duracion, ahoraMs)
    if (ocupadas > mesas) {
      vistos.add(llave)
      conflictos.push({ deporte: r.deporte, fecha: r.fecha, inicio: r.inicio, reservas: ocupadas, mesas })
    }
  }
  return conflictos
}
