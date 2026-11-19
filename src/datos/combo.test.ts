// El combo (30 min de cada juego, uno tras otro: $200 para 2 personas, $280
// para 4 con las palas extra incluidas) en las dos versiones del contrato: la
// simulada y la real (el servidor con la base en memoria). Lo que importa es
// que los dos turnos nunca se separen: se apartan, se pagan, vencen, se mueven
// y se cancelan juntos. Las solicitudes sin modalidad son las de antes del
// 18/11/2026: valen como 2 personas.

import { beforeEach, describe, expect, it } from 'vitest'
import { instante } from '../negocio/tiempo'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import { llevaPalasExtra, total, type Reserva } from '../negocio/reserva'
import { conexionEnMemoria } from '../servidor/conexionEnMemoria'
import { ErrorDeDatos, type PagoSimulado, type ServicioDeDatos, type SolicitudDeCombo } from './contrato'
import { crearServicioReal } from './real'
import { almacenEnMemoria, crearServicioSimulado } from './simulado'

const h = (x: number, m = 0) => x * 60 + m
const VIERNES = '2026-09-25'
let reloj = instante(VIERNES, h(15))
let s: ServicioDeDatos & { pagoSimulado: PagoSimulado }

const combo = (extra: Partial<SolicitudDeCombo> = {}): SolicitudDeCombo => ({
  fecha: VIERNES,
  inicio: h(19),
  primero: 'cornhole',
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

async function pagar(r: Reserva) {
  const { url } = await s.iniciarPago(r.tokenPrivado, [r.partes[0].id], '')
  return s.pagoSimulado.confirmar(url.split('/').pop()!)
}

/** Los dos turnos como los ve el panel, en orden de hora. */
async function turnos(): Promise<Reserva[]> {
  return (await s.reservasEntre(VIERNES, VIERNES)).filter((r) => r.combo)
}

/** Llena un juego a esa hora con reservas de 30 min pagadas. */
async function llenar(deporte: 'pingpong' | 'cornhole', inicio: number) {
  for (let i = 0; i < CONFIGURACION_INICIAL.deportes[deporte].mesas; i++) {
    const r = await s.apartar({ deporte, fecha: VIERNES, inicio, duracion: 30, organizador: { nombre: 'Grupo' + i, whatsapp: '66200000' + String(10 + i) } })
    await pagar(r)
  }
}

describe.each(['simulado', 'real'] as const)('combo · versión %s', (version) => {
  beforeEach(async () => {
    reloj = instante(VIERNES, h(15))
    s =
      version === 'simulado'
        ? crearServicioSimulado({ almacen: almacenEnMemoria(), reloj: () => reloj, conEjemplos: false })
        : crearServicioReal(conexionEnMemoria(() => reloj).conexion)
  })

  it('aparta los dos turnos amarrados: el primero lleva el cobro completo y las palas van aparte', async () => {
    const t1 = await s.apartarCombo(combo({ palasExtra: true }))
    expect(t1).toMatchObject({ deporte: 'cornhole', inicio: h(19), duracion: 30, estado: 'apartada', combo: { turno: 1 } })
    expect(t1.partes.map((p) => p.monto)).toEqual([250])
    await s.iniciarSesion('recepcion', '')
    const [a, b] = await turnos()
    expect(b).toMatchObject({ deporte: 'pingpong', inicio: h(19, 30), duracion: 30, estado: 'apartada', partes: [], folio: `${t1.folio}-2`, palasExtra: 50 })
    expect(a.combo).toEqual({ con: b.id, turno: 1, personas: 2 })
    expect(b.combo).toEqual({ con: a.id, turno: 2, personas: 2 })
    expect(b.apartadaHasta).toBe(a.apartadaHasta)
  })

  it('para 4 personas cuesta $280 con las palas extra incluidas: no se cobran otra vez aunque las pidan', async () => {
    const t1 = await s.apartarCombo(combo({ modalidad: 'estandar', palasExtra: true }))
    expect(t1.partes.map((p) => p.monto)).toEqual([280])
    expect(t1.precio).toBe(280)
    await s.iniciarSesion('recepcion', '')
    const [a, b] = await turnos()
    expect(a.combo?.personas).toBe(4)
    expect(a.modalidad).toBeUndefined()
    // Las palas se entregan en Ping Pong, aunque no se anoten como cobro aparte.
    expect(b).toMatchObject({ deporte: 'pingpong', combo: { personas: 4 } })
    expect(b.palasExtra).toBeUndefined()
    expect([llevaPalasExtra(a), llevaPalasExtra(b)]).toEqual([false, true])
  })

  it('para 2 personas cuesta $200 y el Cornhole va como de 2 personas', async () => {
    const t1 = await s.apartarCombo(combo({ modalidad: 'pareja' }))
    expect(t1.partes.map((p) => p.monto)).toEqual([200])
    await s.iniciarSesion('recepcion', '')
    const [a, b] = await turnos()
    expect(a).toMatchObject({ deporte: 'cornhole', modalidad: 'pareja', combo: { personas: 2 } })
    expect(b.modalidad).toBeUndefined()
    expect([llevaPalasExtra(a), llevaPalasExtra(b)]).toEqual([false, false])
  })

  it('las horas traen el precio de la modalidad; sin ella, el de 2 personas', async () => {
    const precioA = async (modalidad?: 'estandar' | 'pareja') => (await s.disponibilidadCombo(VIERNES, 'cornhole', modalidad)).find((x) => x.inicio === h(19))?.precio
    expect(await precioA('estandar')).toBe(280)
    expect(await precioA('pareja')).toBe(200)
    expect(await precioA()).toBe(200)
  })

  it('solo ofrece las horas con lugar en los dos juegos, según el orden', async () => {
    await llenar('cornhole', h(19))
    const conCornholePrimero = await s.disponibilidadCombo(VIERNES, 'cornhole')
    const conPingPongPrimero = await s.disponibilidadCombo(VIERNES, 'pingpong')
    // Cornhole lleno de 7:00 a 7:30: no cabe empezando ahí con Cornhole, ni
    // con Ping Pong a las 6:30 (el Cornhole caería a las 7:00).
    expect(conCornholePrimero.find((x) => x.inicio === h(19))?.libres).toBe(0)
    expect(conPingPongPrimero.find((x) => x.inicio === h(18, 30))?.libres).toBe(0)
    // Con Ping Pong a las 7:00, el Cornhole es a las 7:30: sí hay.
    expect(conPingPongPrimero.find((x) => x.inicio === h(19))).toMatchObject({ libres: 6, precio: 200 })
    expect(await codigoDe(s.apartarCombo(combo()))).toBe('sin_lugar')
  })

  it('pagar el combo confirma los dos turnos; si vence sin pagar, se sueltan los dos', async () => {
    await pagar(await s.apartarCombo(combo()))
    await s.iniciarSesion('recepcion', '')
    expect((await turnos()).map((r) => r.estado)).toEqual(['confirmada', 'confirmada'])

    await s.apartarCombo(combo({ inicio: h(20), organizador: { nombre: 'Beto', whatsapp: '6620000001' } }))
    reloj += 11 * 60_000
    const vencidos = (await turnos()).filter((r) => r.inicio >= h(20))
    expect(vencidos.map((r) => r.estado)).toEqual(['cancelada', 'cancelada'])
  })

  it('el pago que llega tarde revive los dos turnos solo si los dos siguen libres', async () => {
    const t1 = await s.apartarCombo(combo())
    const { url } = await s.iniciarPago(t1.tokenPrivado, [t1.partes[0].id], '')
    reloj += 11 * 60_000
    await llenar('pingpong', h(19, 30))
    expect(await codigoDe(s.pagoSimulado.confirmar(url.split('/').pop()!))).toBe('apartado_vencido')
    await s.iniciarSesion('recepcion', '')
    expect((await turnos()).map((r) => r.estado)).toEqual(['cancelada', 'cancelada'])
  })

  it('cancelar desde el segundo turno cancela los dos y lo pagado en línea queda por revisar en el primero', async () => {
    await pagar(await s.apartarCombo(combo()))
    await s.iniciarSesion('recepcion', '')
    const [, b] = await turnos()
    await s.cancelarComoNegocio(b.id)
    const [a2, b2] = await turnos()
    expect([a2.estado, b2.estado]).toEqual(['cancelada', 'cancelada'])
    expect(a2.devolucion).toMatchObject({ monto: 200, estado: 'por_revisar' })
    expect(b2.devolucion ?? null).toBeNull()
  })

  it('cambiar horario mueve los dos juntos sin cobrar diferencia, y no mueve nada si el otro juego está lleno', async () => {
    await pagar(await s.apartarCombo(combo()))
    await s.iniciarSesion('recepcion', '')
    const [a] = await turnos()
    await s.cambiarHorario(a.id, VIERNES, h(20))
    const [a2, b2] = await turnos()
    expect([a2.inicio, b2.inicio]).toEqual([h(20), h(20, 30)])
    expect(total(a2)).toBe(200)
    expect(b2.partes).toEqual([])

    await llenar('pingpong', h(21, 30))
    expect(await codigoDe(s.cambiarHorario(a2.id, VIERNES, h(21)))).toBe('sin_lugar')
    const [a3, b3] = await turnos()
    expect([a3.inicio, b3.inicio]).toEqual([h(20), h(20, 30)])
  })

  it('en el de 2 personas, el tiempo extra de Cornhole se cobra a precio de 2 personas', async () => {
    reloj = instante(VIERNES, h(19, 5))
    await s.iniciarSesion('recepcion', '')
    await s.anotarComboSinReserva({ primero: 'pingpong', modalidad: 'pareja', nombre: 'Caro', medio: 'efectivo', precioEsperado: 200 })
    const [, b] = await turnos()
    expect(b).toMatchObject({ deporte: 'cornhole', modalidad: 'pareja' })
    const extendida = await s.extender(b.id, 30)
    expect(extendida.partes.at(-1)).toMatchObject({ concepto: 'extension', monto: 120 })
  })

  it('el tiempo extra va en el segundo juego, a su precio regular', async () => {
    reloj = instante(VIERNES, h(19, 5))
    await s.iniciarSesion('recepcion', '')
    await s.anotarComboSinReserva({ primero: 'cornhole', nombre: 'Caro', medio: 'efectivo', precioEsperado: 200 })
    const [a, b] = await turnos()
    expect(await codigoDe(s.extender(a.id, 30))).toBe('no_permitido')
    const extendida = await s.extender(b.id, 30)
    expect(extendida.partes.at(-1)).toMatchObject({ concepto: 'extension', monto: 100, pago: null })
  })

  it('en el mostrador se cobra al registrarlo: un solo pago de $200 en la caja, y avisa si el precio cambió', async () => {
    reloj = instante(VIERNES, h(18, 10))
    await s.iniciarSesion('recepcion', '')
    // Sin modalidad (un panel abierto con la versión de antes): 2 personas, con palas si las piden.
    expect(await s.cotizarCombo(undefined, true)).toMatchObject({ precio: 200, palasExtra: 50, total: 250 })
    expect(await s.cotizarCombo('estandar', true)).toMatchObject({ precio: 280, palasExtra: 0, total: 280 })
    expect(await s.cotizarCombo('pareja')).toMatchObject({ precio: 200, palasExtra: 0, total: 200 })
    expect(
      await codigoDe(s.anotarComboSinReserva({ primero: 'pingpong', modalidad: 'estandar', nombre: 'Caro', medio: 'efectivo', precioEsperado: 200 })),
    ).toBe('datos_invalidos')
    expect(await codigoDe(s.anotarComboSinReserva({ primero: 'pingpong', nombre: 'Caro', medio: 'efectivo', precioEsperado: 180 }))).toBe('datos_invalidos')
    const t1 = await s.anotarComboSinReserva({ primero: 'pingpong', nombre: 'Caro', medio: 'tarjeta', mesa: 'PP 2', precioEsperado: 200 })
    expect(t1).toMatchObject({ deporte: 'pingpong', estado: 'confirmada', mesa: 'PP 2', inicio: h(18, 10) })
    const [, b] = await turnos()
    expect(b).toMatchObject({ deporte: 'cornhole', inicio: h(18, 40), estado: 'confirmada' })
    expect((await s.pagosDelDia(VIERNES)).map((p) => p.monto)).toEqual([200])
  })

  it('con el combo apagado en Ajustes no se ofrece ni se aparta', async () => {
    await s.iniciarSesion('hugo', '')
    const c = await s.configuracion()
    c.combo.activa = false
    await s.guardarConfiguracion(c)
    expect(await s.disponibilidadCombo(VIERNES, 'cornhole')).toEqual([])
    expect(await codigoDe(s.apartarCombo(combo()))).toBe('datos_invalidos')
  })

  it('Hugo cambia los dos precios en Ajustes, y no se guarda un combo sin precio', async () => {
    await s.iniciarSesion('hugo', '')
    const c = await s.configuracion()
    c.combo.precios = { estandar: 300, pareja: 210 }
    await s.guardarConfiguracion(c)
    expect((await s.apartarCombo(combo({ modalidad: 'estandar' }))).partes[0].monto).toBe(300)
    const sinPrecio = structuredClone(c) as unknown as { combo: Record<string, unknown> }
    delete sinPrecio.combo.precios
    expect(await codigoDe(s.guardarConfiguracion(sinPrecio as never))).toBe('datos_invalidos')
  })
})
