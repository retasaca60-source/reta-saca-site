// Datos de ejemplo de la versión SIMULADA: usuarios de demostración y
// reservas alrededor de hoy, para que el sitio y el panel se vean con vida.
// La versión real no usa nada de esto.

import { mesasEnServicio, type Configuracion, type DeporteId, type Duracion, type Modalidad } from '../negocio/configuracion'
import { nuevoFolio, nuevoId, nuevoToken } from '../negocio/identificadores'
import { precioDe, precioDePalas } from '../negocio/precios'
import type { Reserva } from '../negocio/reserva'
import { sumarDias, type Momento } from '../negocio/tiempo'
import type { Usuario } from './contrato'

export const USUARIOS_DEMO: Usuario[] = [
  { id: 'u-hugo', nombre: 'Hugo', usuario: 'hugo', rol: 'dueno' },
  { id: 'u-recepcion', nombre: 'Recepción', usuario: 'recepcion', rol: 'recepcion' },
]

/**
 * Reservas de ejemplo alrededor de hoy, para que el sitio y el panel se vean
 * con vida: pagadas en línea, una de Cornhole para 2 personas, una de Ping
 * Pong con palas extra y un horario de Cornhole lleno mañana a las 7 PM. Todas
 * en hora cerrada y con tiempos que se venden hoy (Ping Pong 1 h, Cornhole 1 h
 * o 90 min).
 */
export function sembrar(config: Configuracion, ahora: Momento): Reserva[] {
  const hoy = ahora.fecha
  const manana = sumarDias(hoy, 1)
  const pasado = sumarDias(hoy, 2)
  const reservas: Reserva[] = []
  const nombres = ['Carlos M.', 'Ana R.', 'Luis G.', 'Sofía P.', 'Diego T.', 'Mariana L.', 'Jorge V.', 'Paola S.', 'Iván C.', 'Fer N.']
  let n = 0
  const nueva = (deporte: DeporteId, fecha: string, inicio: number, duracion: Duracion, opciones: { modalidad?: Modalidad; palasExtra?: boolean } = {}) => {
    const { precio, conPromo } = precioDe(config, deporte, inicio, duracion, opciones.modalidad)
    const palas = precioDePalas(config.deportes[deporte], opciones.palasExtra)
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
      ...(opciones.modalidad === 'pareja' ? { modalidad: 'pareja' as const } : {}),
      ...(palas ? { palasExtra: palas } : {}),
      partesElegidas: 1,
      partes: [
        {
          id: nuevoId(),
          monto: precio + palas,
          delOrganizador: true,
          concepto: 'reserva',
          pago: { medio: 'en_linea', nombre, en: new Date(ahora.ms - 86400_000).toISOString() },
        },
      ],
      organizador: { nombre, whatsapp: '66200000' + String(n).padStart(2, '0') },
      origen: 'sitio',
      estado: 'confirmada',
      apartadaHasta: null,
      mesa: null,
      llegaronEn: null,
      cancelacion: null,
      creadaEn: new Date(ahora.ms - 86400_000).toISOString(),
    }
    reservas.push(r)
  }
  const h = (x: number) => x * 60
  // Hoy
  nueva('pingpong', hoy, h(17), 60)
  nueva('pingpong', hoy, h(18), 60, { palasExtra: true })
  nueva('cornhole', hoy, h(19), 60)
  nueva('cornhole', hoy, h(20), 90, { modalidad: 'pareja' })
  // Mañana: Cornhole lleno a las 7 PM
  for (let i = 0; i < mesasEnServicio(config.deportes.cornhole); i++) nueva('cornhole', manana, h(19), 60)
  nueva('pingpong', manana, h(17), 60)
  // Pasado mañana
  nueva('pingpong', pasado, h(20), 60)
  return reservas
}
