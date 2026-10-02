// Los casos de la revisión del 01/10/2026 (segunda ronda): cada uno reproduce
// lo que se reportó y comprueba que ya no pasa. Corren contra la versión
// simulada y contra la real (el servidor con la base en memoria).

import { beforeEach, describe, expect, it } from 'vitest'
import { instante } from '../negocio/tiempo'
import { ErrorDeDatos, type PagoSimulado, type ServicioDeDatos, type SolicitudDeReserva } from './contrato'
import { conexionEnMemoria } from '../servidor/conexionEnMemoria'
import { crearServicioReal } from './real'
import { almacenDelNavegador, almacenEnMemoria, crearServicioSimulado } from './simulado'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import { total } from '../negocio/reserva'

const h = (x: number, m = 0) => x * 60 + m
const VIERNES = '2026-09-25'
let reloj = instante(VIERNES, h(15))
let s: ServicioDeDatos & { pagoSimulado: PagoSimulado }

const pedido = (extra: Partial<SolicitudDeReserva> = {}): SolicitudDeReserva => ({
  deporte: 'pingpong',
  fecha: VIERNES,
  inicio: h(19),
  duracion: 60,
  partes: 1,
  organizador: { nombre: 'Ana', whatsapp: '6621112233' },
  ...extra,
})

const codigoDe = async (p: Promise<unknown>) => {
  try {
    await p
    return 'sin error'
  } catch (e) {
    return e instanceof ErrorDeDatos ? e.codigo : String(e)
  }
}

async function reservarYPagar(extra: Partial<SolicitudDeReserva> = {}) {
  const r = await s.apartar(pedido(extra))
  const { url } = await s.iniciarPago(r.tokenPrivado, [r.partes[0].id], '')
  await s.pagoSimulado.confirmar(url.split('/').pop()!)
  return (await s.reservaPorTokenPrivado(r.tokenPrivado))!
}

describe.each(['simulado', 'real'] as const)('revisión, versión %s', (version) => {
  beforeEach(async () => {
    reloj = instante(VIERNES, h(15))
    s =
      version === 'simulado'
        ? crearServicioSimulado({ almacen: almacenEnMemoria(), reloj: () => reloj, conEjemplos: false })
        : crearServicioReal(conexionEnMemoria(() => reloj).conexion)
  })

  it('1. la caja muestra un cobro aunque la reserva se haya movido lejos', async () => {
    const r = await reservarYPagar()
    await s.iniciarSesion('hugo', '')
    await s.cambiarHorario(r.id, '2026-12-01', h(19))
    const pagos = await s.pagosDelDia(VIERNES)
    expect(pagos.map((p) => p.reservaId)).toContain(r.id)
  })

  it('2 y 21. Ajustes no acepta paso 0, apartado de 0 ni horarios encimados', async () => {
    await s.iniciarSesion('hugo', '')
    const base = await s.configuracion()
    const con = (f: (c: typeof base) => void) => {
      const c = structuredClone(base)
      f(c)
      return s.guardarConfiguracion(c)
    }
    expect(await codigoDe(con((c) => void (c.reglas.pasoDeInicio = 0)))).toBe('datos_invalidos')
    expect(await codigoDe(con((c) => void (c.reglas.minutosDeApartado = 0)))).toBe('datos_invalidos')
    expect(await codigoDe(con((c) => void c.horario[1].push({ ...c.horario[1][0] })))).toBe('datos_invalidos')
    expect(await codigoDe(con((c) => void (c.horario[1] = [{ desde: h(17), hasta: h(20) }, { desde: h(19), hasta: h(22) }])))).toBe('datos_invalidos')
    expect((await s.configuracion()).reglas.pasoDeInicio).toBe(30)
  })

  it('3. no se guardan precios que bajan con más tiempo (la extensión saldría negativa)', async () => {
    await s.iniciarSesion('hugo', '')
    const c = await s.configuracion()
    c.deportes.pingpong.precios[60] = 150
    c.deportes.pingpong.precios[90] = 100
    expect(await codigoDe(s.guardarConfiguracion(c))).toBe('datos_invalidos')
  })

  it('4. mover al mismo horario no cobra diferencia ni borra la mesa', async () => {
    await s.iniciarSesion('hugo', '')
    reloj = instante(VIERNES, h(19, 5))
    const r = await s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Beto', mesa: 'PP 2', medio: 'efectivo' })
    const c = await s.configuracion()
    c.deportes.pingpong.precios[60] = 300
    c.deportes.pingpong.precios[90] = 400
    c.deportes.pingpong.precios[120] = 500
    await s.guardarConfiguracion(c)
    expect(await codigoDe(s.cambiarHorario(r.id, r.fecha, r.inicio))).toBe('datos_invalidos')
    const despues = (await s.reservaPorTokenPrivado(r.tokenPrivado))!
    expect(total(despues)).toBe(total(r))
    expect(despues.mesa).toBe('PP 2')
    expect(despues.llegaronEn).not.toBeNull()
  })

  it('5. el mostrador cotiza con la hora de los datos y no registra si el precio no es el que se vio', async () => {
    await s.iniciarSesion('hugo', '')
    reloj = instante(VIERNES, h(17, 10))
    const cot = await s.cotizarSinReserva('pingpong', 60)
    expect(cot).toMatchObject({ precio: 120, conPromo: true, inicio: h(17, 10) })
    const antes = (await s.reservasEntre(VIERNES, VIERNES)).length
    expect(await codigoDe(s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Beto', medio: 'efectivo', precioEsperado: 150 }))).toBe(
      'datos_invalidos',
    )
    expect((await s.reservasEntre(VIERNES, VIERNES)).length).toBe(antes)
    const r = await s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Beto', medio: 'efectivo', precioEsperado: 120 })
    expect(total(r)).toBe(120)
  })

  it('6. quitar mesas avisa de una reserva movida a diciembre', async () => {
    const r = await reservarYPagar()
    await s.iniciarSesion('hugo', '')
    await s.cambiarHorario(r.id, '2026-12-01', h(19))
    const c = await s.configuracion()
    c.deportes.pingpong.mesas = 0
    const res = await s.guardarConfiguracion(c)
    expect(res.guardada).toBe(false)
    expect(res.conflictos.map((x) => x.fecha)).toContain('2026-12-01')
  })

  it('7. cerrar un día avisa de un apartado que todavía está pagando', async () => {
    await s.apartar(pedido())
    await s.iniciarSesion('hugo', '')
    const c = await s.configuracion()
    c.diasCerrados = [VIERNES]
    const res = await s.guardarConfiguracion(c)
    expect(res.guardada).toBe(false)
    expect(res.conflictos).toHaveLength(1)
  })

  it('8. poner fuera de servicio una mesa ocupada avisa aunque sobren mesas', async () => {
    await s.iniciarSesion('hugo', '')
    reloj = instante(VIERNES, h(19, 5))
    await s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Beto', mesa: 'PP 1', medio: 'efectivo' })
    const c = await s.configuracion()
    c.deportes.pingpong.fueraDeServicio = [1]
    const res = await s.guardarConfiguracion(c)
    expect(res.guardada).toBe(false)
    expect(res.conflictos).toEqual([expect.objectContaining({ mesa: 'PP 1', nombre: 'Beto' })])
  })

  it('9. no acepta fechas que no existen', async () => {
    const r = await reservarYPagar()
    await s.iniciarSesion('hugo', '')
    expect(await codigoDe(s.cambiarHorario(r.id, '2026-10-32', h(19)))).not.toBe('sin error')
    // El 31 de septiembre cae "dentro" de la ventana si se compara como texto.
    expect(await codigoDe(s.apartar(pedido({ fecha: '2026-09-31', organizador: { nombre: 'Eva', whatsapp: '6620000001' } })))).not.toBe('sin error')
    expect(await s.disponibilidad('pingpong', '2026-09-31', 60).catch(() => [])).toEqual([])
  })

  it('10. no mueve al pasado ni a minutos fuera de los intervalos', async () => {
    const r = await reservarYPagar()
    await s.iniciarSesion('hugo', '')
    expect(await codigoDe(s.cambiarHorario(r.id, '2026-09-24', h(19)))).toBe('fuera_de_horario')
    expect(await codigoDe(s.cambiarHorario(r.id, VIERNES, h(18, 7)))).toBe('fuera_de_horario')
    reloj = instante(VIERNES, h(18, 10))
    // El turno que está corriendo sí (llegaron tarde a las 6:00); el anterior no.
    expect((await s.cambiarHorario(r.id, VIERNES, h(18))).inicio).toBe(h(18))
    expect(await codigoDe(s.cambiarHorario(r.id, VIERNES, h(17, 30)))).toBe('fuera_de_horario')
  })

  it('11. no extiende en un día marcado como cerrado', async () => {
    await s.iniciarSesion('hugo', '')
    reloj = instante(VIERNES, h(19, 5))
    const r = await s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Beto', medio: 'efectivo' })
    const c = await s.configuracion()
    c.diasCerrados = [VIERNES]
    await s.guardarConfiguracion(c, true)
    expect(await codigoDe(s.extender(r.id, 30))).toBe('fuera_de_horario')
  })

  it('12. no sienta una reserva cancelada', async () => {
    const r = await reservarYPagar()
    await s.iniciarSesion('hugo', '')
    await s.cancelarComoNegocio(r.id)
    expect(await codigoDe(s.asignarMesa(r.id, 'PP 1'))).toBe('no_permitido')
    expect((await s.reservaPorTokenPrivado(r.tokenPrivado))!.mesa).toBeNull()
  })
})

describe('demostración: lo guardado en el navegador', () => {
  it('22. si el navegador no deja guardar, sigue en memoria y la sesión no se pierde', async () => {
    // En las pruebas no existe localStorage: es el caso del almacenamiento bloqueado.
    const demo = crearServicioSimulado({ almacen: almacenDelNavegador(), reloj: () => reloj, conEjemplos: false })
    await demo.iniciarSesion('hugo', '')
    expect((await demo.sesion())?.usuario).toBe('hugo')
  })

  it('23. lo guardado sin promo.inicios se descarta en vez de tronar la disponibilidad', async () => {
    const almacen = almacenEnMemoria()
    const config = structuredClone(CONFIGURACION_INICIAL) as unknown as { promo: Record<string, unknown> }
    delete config.promo.inicios
    almacen.escribir(JSON.stringify({ version: 1, config, reservas: [], intentos: [], usuarios: [], sesion: null }))
    const demo = crearServicioSimulado({ almacen, reloj: () => reloj, conEjemplos: false })
    expect((await demo.disponibilidad('pingpong', VIERNES, 60)).length).toBeGreaterThan(0)
  })
})
