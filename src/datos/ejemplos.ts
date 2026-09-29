// Datos de ejemplo de la versión SIMULADA: usuarios de demostración y
// reservas alrededor de hoy, para que el sitio y el panel se vean con vida.
// La versión real no usa nada de esto.

import { mesasEnServicio, type Configuracion, type DeporteId, type Duracion } from '../negocio/configuracion'
import { nuevoFolio, nuevoId, nuevoToken } from '../negocio/identificadores'
import { precioDe } from '../negocio/precios'
import { repartir, type Reserva } from '../negocio/reserva'
import { sumarDias, type Momento } from '../negocio/tiempo'
import type { Usuario } from './contrato'

export const USUARIOS_DEMO: Usuario[] = [
  { id: 'u-hugo', nombre: 'Hugo', usuario: 'hugo', rol: 'dueno' },
  { id: 'u-recepcion', nombre: 'Recepción', usuario: 'recepcion', rol: 'recepcion' },
]

/**
 * Reservas de ejemplo alrededor de hoy, para que el sitio y el panel se vean
 * con vida: pagos completos, a medias, un cliente sin reserva y un horario de
 * Cornhole lleno mañana a las 7 PM.
 */
export function sembrar(config: Configuracion, ahora: Momento): Reserva[] {
  const hoy = ahora.fecha
  const manana = sumarDias(hoy, 1)
  const pasado = sumarDias(hoy, 2)
  const reservas: Reserva[] = []
  const nombres = ['Carlos M.', 'Ana R.', 'Luis G.', 'Sofía P.', 'Diego T.', 'Mariana L.', 'Jorge V.', 'Paola S.', 'Iván C.', 'Fer N.']
  let n = 0
  const nueva = (
    deporte: DeporteId,
    fecha: string,
    inicio: number,
    duracion: Duracion,
    partes: 1 | 2 | 4,
    pagadas: number,
    extra: Partial<Reserva> = {},
  ) => {
    const { precio, conPromo } = precioDe(config, deporte, inicio, duracion)
    const nombre = nombres[n % nombres.length]
    n++
    const r: Reserva = {
      id: nuevoId(),
      folio: nuevoFolio(),
      tokenPrivado: nuevoToken(),
      tokenCobro: nuevoToken(),
      deporte,
      fecha,
      inicio,
      duracion,
      precio,
      conPromo,
      partesElegidas: partes,
      partes: repartir(precio, partes).map((monto, i) => ({
        id: nuevoId(),
        monto,
        delOrganizador: i === 0,
        concepto: 'reserva',
        pago: i < pagadas ? { medio: 'en_linea', nombre: i === 0 ? nombre : `Amigo ${i}`, en: new Date(ahora.ms - 86400_000).toISOString() } : null,
      })),
      organizador: { nombre, whatsapp: '66200000' + String(n).padStart(2, '0') },
      origen: 'sitio',
      estado: 'confirmada',
      apartadaHasta: null,
      mesa: null,
      llegaronEn: null,
      cancelacion: null,
      creadaEn: new Date(ahora.ms - 86400_000).toISOString(),
      ...extra,
    }
    reservas.push(r)
  }
  const h = (x: number, m = 0) => x * 60 + m
  // Hoy
  nueva('pingpong', hoy, h(17), 60, 2, 2)
  nueva('pingpong', hoy, h(18), 90, 4, 1)
  nueva('cornhole', hoy, h(19), 60, 4, 3)
  nueva('popdarts', hoy, h(20), 60, 1, 1)
  nueva('cornhole', hoy, h(20), 120, 1, 1)
  // Mañana: Cornhole lleno a las 7 PM
  for (let i = 0; i < mesasEnServicio(config.deportes.cornhole); i++) nueva('cornhole', manana, h(19), 60, 2, 1)
  nueva('pingpong', manana, h(17, 30), 60, 4, 2)
  nueva('popdarts', manana, h(18), 90, 1, 1)
  // Pasado mañana
  nueva('pingpong', pasado, h(20), 60, 1, 1)
  return reservas
}
