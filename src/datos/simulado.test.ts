// Cómo se debe comportar CUALQUIER versión del contrato de datos. Hoy se
// prueba la simulada; la versión real (Supabase) tiene que pasar las mismas
// situaciones (ver CONTRATO-DE-DATOS.md → "Casos que la versión real debe pasar").

import { beforeEach, describe, expect, it } from 'vitest'
import { instante } from '../negocio/tiempo'
import { ErrorDeDatos, type SolicitudDeReserva } from './contrato'
import { almacenEnMemoria, crearServicioSimulado, type ServicioSimulado } from './simulado'
import { total } from '../negocio/reserva'

const h = (x: number, m = 0) => x * 60 + m
const VIERNES = '2026-09-25'
let reloj = instante(VIERNES, h(15))
let s: ServicioSimulado

const pedido = (extra: Partial<SolicitudDeReserva> = {}): SolicitudDeReserva => ({
  deporte: 'popdarts',
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

/** Aparta y paga la parte del organizador, como hace el sitio. */
async function reservarYPagar(extra: Partial<SolicitudDeReserva> = {}) {
  const r = await s.apartar(pedido(extra))
  const { url } = await s.iniciarPago(r.tokenPrivado, [r.partes[0].id], '')
  await s.pagoSimulado.confirmar(url.split('/').pop()!)
  return (await s.reservaPorTokenPrivado(r.tokenPrivado))!
}

beforeEach(() => {
  reloj = instante(VIERNES, h(15))
  s = crearServicioSimulado({ almacen: almacenEnMemoria(), reloj: () => reloj, conEjemplos: false })
})

describe('reservar', () => {
  it('aparta con el precio por mesa y lo divide en pesos cerrados', async () => {
    const r = await s.apartar(pedido({ deporte: 'pingpong', partes: 4 }))
    expect(r.estado).toBe('apartada')
    expect(r.precio).toBe(150)
    expect(r.partes.map((p) => p.monto)).toEqual([39, 37, 37, 37])
    expect(r.folio).toMatch(/^RS-[2-9A-HJKMNP-Z]{5}$/)
  })
  it('Popdarts siempre queda en un solo pago, aunque pidan dividir', async () => {
    const r = await s.apartar(pedido({ partes: 4 }))
    expect(r.partes).toHaveLength(1)
  })
  it('queda firme con el primer pago', async () => {
    const r = await reservarYPagar({ deporte: 'cornhole', partes: 4 })
    expect(r.estado).toBe('confirmada')
    expect(r.partes.filter((p) => p.pago)).toHaveLength(1)
  })
  it('no vende una mesa de más: con las 3 de Popdarts ocupadas, la cuarta falla', async () => {
    for (let i = 0; i < 3; i++) await reservarYPagar({ organizador: { nombre: 'X' + i, whatsapp: '662000000' + i } })
    expect(await codigoDe(s.apartar(pedido({ organizador: { nombre: 'Yola', whatsapp: '6629999999' } })))).toBe('sin_lugar')
  })
  it('una reserva apartada ocupa mesa 10 minutos y luego se libera sola', async () => {
    for (let i = 0; i < 3; i++) await s.apartar(pedido({ organizador: { nombre: 'X' + i, whatsapp: '662000000' + i } }))
    expect(await codigoDe(s.apartar(pedido({ organizador: { nombre: 'Yola', whatsapp: '6629999999' } })))).toBe('sin_lugar')
    reloj += 10 * 60_000
    expect(await codigoDe(s.apartar(pedido({ organizador: { nombre: 'Yola', whatsapp: '6629999999' } })))).toBe('sin error')
  })
  it('volver a tocar "Pagar" no alarga el apartado: a los 10 min se libera aunque lo intente', async () => {
    const r = await s.apartar(pedido())
    for (let i = 0; i < 2; i++) {
      reloj += 4 * 60_000
      await s.iniciarPago(r.tokenPrivado, [r.partes[0].id], '')
    }
    reloj += 3 * 60_000 // 11 min desde que apartó
    expect((await s.reservaPorTokenPrivado(r.tokenPrivado))!.estado).toBe('cancelada')
    expect(await codigoDe(s.iniciarPago(r.tokenPrivado, [r.partes[0].id], ''))).toBe('no_permitido')
  })
  it('un pago que llega ya vencido el apartado se acepta solo si la mesa sigue libre', async () => {
    const r = await s.apartar(pedido())
    const { url } = await s.iniciarPago(r.tokenPrivado, [r.partes[0].id], '')
    reloj += 11 * 60_000
    await s.pagoSimulado.confirmar(url.split('/').pop()!)
    expect((await s.reservaPorTokenPrivado(r.tokenPrivado))!.estado).toBe('confirmada')
  })
  it('máximo 2 reservas activas por WhatsApp', async () => {
    await reservarYPagar({ inicio: h(17) })
    await reservarYPagar({ inicio: h(18) })
    expect(await codigoDe(s.apartar(pedido({ inicio: h(20) })))).toBe('limite_whatsapp')
  })
  it('no deja reservar fuera de horario, pasado el corte ni más allá de 7 días', async () => {
    expect(await codigoDe(s.apartar(pedido({ inicio: h(21, 30) })))).toBe('fuera_de_horario') // 60 min terminaría 10:30
    reloj = instante(VIERNES, h(18, 40))
    expect(await codigoDe(s.apartar(pedido({ inicio: h(19) })))).toBe('fuera_de_horario') // menos de 30 min antes
    expect(await codigoDe(s.apartar(pedido({ fecha: '2026-10-03' })))).toBe('fuera_de_horario')
  })
})

describe('pago dividido', () => {
  it('el link de cobro no enseña el WhatsApp del organizador', async () => {
    const r = await reservarYPagar({ deporte: 'pingpong', partes: 2 })
    const vista = await s.vistaDeCobro(r.tokenCobro)
    expect(JSON.stringify(vista)).not.toContain('6621112233')
    expect(vista!.partes.map((p) => p.pagada)).toEqual([true, false])
  })
  it('un amigo paga su parte con su nombre, o "lo que falta"', async () => {
    const r = await reservarYPagar({ deporte: 'pingpong', partes: 4 })
    const pendientes = r.partes.filter((p) => !p.pago).map((p) => p.id)
    const { url } = await s.iniciarPago(r.tokenCobro, pendientes, 'Luis')
    await s.pagoSimulado.confirmar(url.split('/').pop()!)
    const despues = await s.reservaPorTokenPrivado(r.tokenPrivado)
    expect(despues!.partes.every((p) => p.pago)).toBe(true)
    expect(despues!.partes[1].pago!.nombre).toBe('Luis')
  })
  it('no se paga dos veces la misma parte', async () => {
    const r = await reservarYPagar()
    expect(await codigoDe(s.iniciarPago(r.tokenPrivado, [r.partes[0].id], ''))).toBe('datos_invalidos')
  })
})

describe('cancelar', () => {
  it('hasta 2 h antes devuelve lo pagado en línea; después cancela sin devolver', async () => {
    const a = await reservarYPagar({ inicio: h(19) })
    reloj = instante(VIERNES, h(16, 59))
    const cancelada = await s.cancelarComoCliente(a.tokenPrivado)
    expect(cancelada.partes[0].pago!.devuelto).toBe(true)

    reloj = instante(VIERNES, h(15))
    const b = await reservarYPagar({ inicio: h(20), organizador: { nombre: 'Beto', whatsapp: '6620000009' } })
    reloj = instante(VIERNES, h(18, 30))
    const sinDevolver = await s.cancelarComoCliente(b.tokenPrivado)
    expect(sinDevolver.estado).toBe('cancelada')
    expect(sinDevolver.partes[0].pago!.devuelto).toBeUndefined()
  })
})

describe('panel', () => {
  beforeEach(async () => {
    await s.iniciarSesion('recepcion@demo.retasaca', '')
  })

  it('sin sesión no se ven reservas', async () => {
    await s.cerrarSesion()

    expect(
      await codigoDe(s.reservasEntre(VIERNES, VIERNES)),
    ).toBe('sin_sesion')
  })

  it('recepción marca un pago en efectivo y queda quién lo marcó', async () => {
    const r = await reservarYPagar({
      deporte: 'cornhole',
      partes: 2,
    })

    const despues = await s.marcarPago(
      r.id,
      [r.partes[1].id],
      'efectivo',
      'Pedro',
    )

    expect(despues.partes[1].pago).toMatchObject({
      medio: 'efectivo',
      nombre: 'Pedro',
      marcadoPor: 'Recepción',
    })
  })

  it('no asigna una mesa que ya tiene otro grupo a esa hora', async () => {
    const a = await reservarYPagar()
    const b = await reservarYPagar({
      organizador: {
        nombre: 'Beto',
        whatsapp: '6620000009',
      },
    })

    await s.asignarMesa(a.id, 'PD 1')

    expect(
      await codigoDe(s.asignarMesa(b.id, 'PD 1')),
    ).toBe('no_permitido')

    expect(
      (await s.asignarMesa(b.id, 'PD 2')).mesa,
    ).toBe('PD 2')
  })

  it('extender cobra la diferencia de la tabla y revisa que haya lugar', async () => {
    const r = await reservarYPagar({
      deporte: 'pingpong',
      inicio: h(19),
    })

    const ext = await s.extender(r.id, 30)

    expect(ext.duracion).toBe(90)
    expect(ext.partes.at(-1)).toMatchObject({
      concepto: 'extension',
      monto: 70,
      pago: null,
    })
  })

  it('liberar por retraso solo pasada la tolerancia', async () => {
    const r = await reservarYPagar({
      inicio: h(19),
    })

    reloj = instante(VIERNES, h(19, 10))

    expect(
      await codigoDe(s.liberarPorRetraso(r.id)),
    ).toBe('no_permitido')

    reloj = instante(VIERNES, h(19, 20))

    expect(
      (await s.liberarPorRetraso(r.id)).cancelacion?.motivo,
    ).toBe('no_llego')
  })

  it('recepción no puede cambiar la configuración; el dueño sí', async () => {
    const config = await s.configuracion()

    expect(
      await codigoDe(s.guardarConfiguracion(config)),
    ).toBe('no_permitido')

    await s.iniciarSesion('hugo@demo.retasaca', '')

    expect(
      (await s.guardarConfiguracion(config)).guardada,
    ).toBe(true)
  })

  it('quitar mesas con reservas encima avisa y no guarda, salvo que Hugo insista', async () => {
    await s.iniciarSesion('hugo@demo.retasaca', '')

    for (let i = 0; i < 3; i++) {
      await reservarYPagar({
        organizador: {
          nombre: 'X' + i,
          whatsapp: '662000000' + i,
        },
      })
    }

    const config = await s.configuracion()
    config.deportes.popdarts.mesas = 2

    const intento = await s.guardarConfiguracion(config)

    expect(intento.guardada).toBe(false)
    expect(intento.conflictos[0]).toMatchObject({
      deporte: 'popdarts',
      inicio: h(19),
      reservas: 3,
      mesas: 2,
    })

    expect(
      (await s.guardarConfiguracion(config, true)).guardada,
    ).toBe(true)

    // Nunca se cancela ninguna reserva automáticamente.
    const reservas = await s.reservasEntre(VIERNES, VIERNES)

    expect(
      reservas.filter((r) => r.estado === 'confirmada'),
    ).toHaveLength(3)
  })

  it('una reserva conserva su precio aunque Hugo lo cambie después', async () => {
    const r = await reservarYPagar()

    await s.iniciarSesion('hugo@demo.retasaca', '')

    const config = await s.configuracion()
    config.deportes.popdarts.precios[60] = 200

    await s.guardarConfiguracion(config)

    const despues = await s.reservaPorTokenPrivado(r.tokenPrivado)

    expect(despues!.precio).toBe(120)
  })

  it('no cobra otra vez la diferencia al cambiar entre horarios del mismo precio', async () => {
    const reserva = await reservarYPagar({
      deporte: 'pingpong',
      inicio: h(17),
      duracion: 60,
    })

    expect(total(reserva)).toBe(120)

    const primerCambio = await s.cambiarHorario(
      reserva.id,
      VIERNES,
      h(19),
    )

    expect(total(primerCambio)).toBe(150)

    const segundoCambio = await s.cambiarHorario(
      reserva.id,
      VIERNES,
      h(20),
    )

    expect(total(segundoCambio)).toBe(150)
  })

  it('no vuelve a cobrar una extensión al cambiar de horario', async () => {
    const reserva = await reservarYPagar({
      deporte: 'pingpong',
      inicio: h(19),
      duracion: 60,
    })

    const extendida = await s.extender(reserva.id, 30)

    expect(total(extendida)).toBe(220)

    const movida = await s.cambiarHorario(
      reserva.id,
      VIERNES,
      h(20),
    )

    expect(total(movida)).toBe(220)
  })
})

describe('datos de ejemplo', () => {
  it('respetan el horario y el inventario: guardar la configuración tal cual no da conflictos', async () => {
    const conEjemplos = crearServicioSimulado({ almacen: almacenEnMemoria(), reloj: () => reloj })
    await conEjemplos.iniciarSesion('hugo@demo.retasaca', '')
    const r = await conEjemplos.guardarConfiguracion(await conEjemplos.configuracion())
    expect(r.conflictos).toEqual([])
  })
})

describe('datos guardados por otra versión', () => {
  it('si lo guardado no tiene la forma esperada, se empieza de cero en vez de romper', async () => {
    const almacen = almacenEnMemoria()
    almacen.escribir(JSON.stringify({ version: 1, config: {}, reservas: [{ id: 3 }] }))
    const otro = crearServicioSimulado({ almacen, reloj: () => reloj, conEjemplos: false })
    expect((await otro.configuracion()).deportes.pingpong.mesas).toBe(6)
  })
})
