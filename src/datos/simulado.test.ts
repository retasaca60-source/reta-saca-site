// Cómo se debe comportar CUALQUIER versión del contrato de datos. Cada caso
// corre dos veces: contra la versión simulada y contra la real (el servidor de
// servidor/api.ts, el mismo que corre en Supabase, con la base en memoria).
// Los dos últimos bloques son solo de la simulada.

import { beforeEach, describe, expect, it } from 'vitest'
import { instante } from '../negocio/tiempo'
import { ErrorDeDatos, type SolicitudDeReserva } from './contrato'
import { conexionEnMemoria } from '../servidor/conexionEnMemoria'
import type { PagoSimulado, ServicioDeDatos } from './contrato'
import { crearServicioReal } from './real'
import { almacenEnMemoria, crearServicioSimulado } from './simulado'
import { total } from '../negocio/reserva'

const h = (x: number, m = 0) => x * 60 + m
const VIERNES = '2026-09-25'
let reloj = instante(VIERNES, h(15))
let s: ServicioDeDatos & { pagoSimulado: PagoSimulado }

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


describe.each(['simulado', 'real'] as const)('versión %s', (version) => {
  beforeEach(() => {
    reloj = instante(VIERNES, h(15))
    s =
      version === 'simulado'
        ? crearServicioSimulado({ almacen: almacenEnMemoria(), reloj: () => reloj, conEjemplos: false })
        : crearServicioReal(conexionEnMemoria(() => reloj).conexion)
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
    it('un mismo WhatsApp no puede tener más de 2 mesas apartadas sin pagar; las pagadas no cuentan', async () => {
      const ana = { nombre: 'Ana', whatsapp: '6621112233' }
      // Dos pagadas (no cuentan) y dos apartadas sin pagar: la quinta se frena.
      await reservarYPagar({ deporte: 'pingpong', inicio: h(18), organizador: ana })
      await reservarYPagar({ deporte: 'pingpong', inicio: h(19), organizador: ana })
      const primera = await s.apartar(pedido({ deporte: 'cornhole', inicio: h(18), organizador: ana }))
      await s.apartar(pedido({ deporte: 'cornhole', inicio: h(19), organizador: ana }))
      expect(await codigoDe(s.apartar(pedido({ organizador: ana })))).toBe('demasiados_intentos')
      // Otro número sí puede, y al pagar una, Ana vuelve a poder.
      expect(await codigoDe(s.apartar(pedido({ organizador: { nombre: 'Beto', whatsapp: '6620000009' } })))).toBe('sin error')
      const { url } = await s.iniciarPago(primera.tokenPrivado, [primera.partes[0].id], '')
      await s.pagoSimulado.confirmar(url.split('/').pop()!)
      expect(await codigoDe(s.apartar(pedido({ organizador: ana })))).toBe('sin error')
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
     it('permite varias reservas con el mismo WhatsApp sin exceder la capacidad', async () => {
      // Popdarts tiene 3 lugares: el teléfono puede repetirse,
      // pero la cuarta reserva del mismo horario debe rechazarse.
      const reservas = []

      for (let i = 0; i < 3; i++) {
        reservas.push(await reservarYPagar())
      }

      expect(new Set(reservas.map((r) => r.id)).size).toBe(3)

      expect(
        reservas.every(
          (r) => r.organizador.whatsapp === '6621112233',
        ),
      ).toBe(true)

      expect(
        await codigoDe(s.apartar(pedido())),
      ).toBe('sin_lugar')
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
      const r = await reservarYPagar({
        deporte: 'pingpong',
        partes: 2,
      })

      const vista = await s.vistaDeCobro(r.tokenCobro)

      expect(JSON.stringify(vista)).not.toContain('6621112233')
      expect(vista!.partes.map((p) => p.pagada)).toEqual([true, false])
    })

    it('un amigo paga su parte con su nombre, o "lo que falta"', async () => {
      const r = await reservarYPagar({
        deporte: 'pingpong',
        partes: 4,
      })

      const pendientes = r.partes
        .filter((p) => !p.pago)
        .map((p) => p.id)

      const { url } = await s.iniciarPago(
        r.tokenCobro,
        pendientes,
        'Luis',
      )

      await s.pagoSimulado.confirmar(url.split('/').pop()!)

      const despues = await s.reservaPorTokenPrivado(r.tokenPrivado)

      expect(despues!.partes.every((p) => p.pago)).toBe(true)
      expect(despues!.partes[1].pago!.nombre).toBe('Luis')
    })
    it('el pago de un amigo solo entrega los campos de la pantalla y permite pagar', async () => {
      const r = await reservarYPagar({
        deporte: 'pingpong',
        partes: 4,
      })

      const parte = r.partes[1]
      const { url } = await s.iniciarPago(
        r.tokenCobro,
        [parte.id],
        'Luis',
      )
      const id = url.split('/').pop()!

      // La comparación exacta falla si se vuelve a incluir la reserva
      // completa, el WhatsApp, los tokens o cualquier otro campo extra.
      expect(await s.pagoSimulado.obtener(id)).toEqual({
        intento: {
          nombre: 'Luis',
          monto: parte.monto,
          resultado: null,
        },
        reserva: {
          folio: r.folio,
          fecha: r.fecha,
          inicio: r.inicio,
        },
      })

      expect(await s.pagoSimulado.confirmar(id)).toBe(
        `/c/${r.tokenCobro}?pago=aprobado`,
      )

      const despues = await s.reservaPorTokenPrivado(r.tokenPrivado)

      expect(despues!.partes[1].pago!.nombre).toBe('Luis')

      // El WhatsApp se conserva en la reserva privada.
      expect(despues!.organizador.whatsapp).toBe(
        r.organizador.whatsapp,
      )
    })
    it('no se paga dos veces la misma parte', async () => {
      const r = await reservarYPagar()

      expect(
        await codigoDe(
          s.iniciarPago(r.tokenPrivado, [r.partes[0].id], ''),
        ),
      ).toBe('datos_invalidos')
    })

    it('rechaza un segundo intento sobre una parte que ya fue pagada', async () => {
      const r = await reservarYPagar({
        deporte: 'cornhole',
        partes: 4,
      })

      const parteId = r.partes[1].id

      const intentoLuis = await s.iniciarPago(
        r.tokenCobro,
        [parteId],
        'Luis',
      )

      const intentoBeto = await s.iniciarPago(
        r.tokenCobro,
        [parteId],
        'Beto',
      )

      const idLuis = intentoLuis.url.split('/').pop()!
      const idBeto = intentoBeto.url.split('/').pop()!

      await s.pagoSimulado.confirmar(idLuis)

      await expect(
        s.pagoSimulado.confirmar(idBeto),
      ).rejects.toMatchObject({
        codigo: 'datos_invalidos',
      })

      const despues = await s.reservaPorTokenPrivado(r.tokenPrivado)
      expect(despues!.partes[1].pago!.nombre).toBe('Luis')

      const intentoRechazado = await s.pagoSimulado.obtener(idBeto)
      expect(intentoRechazado!.intento.resultado).toBeNull()
    })

    it('confirmar dos veces el mismo intento no duplica ni modifica el pago', async () => {
      const r = await reservarYPagar({
        deporte: 'cornhole',
        partes: 4,
      })

      const intento = await s.iniciarPago(
        r.tokenCobro,
        [r.partes[1].id],
        'Luis',
      )

      const id = intento.url.split('/').pop()!

      await s.pagoSimulado.confirmar(id)
      const antes = await s.reservaPorTokenPrivado(r.tokenPrivado)

      await s.pagoSimulado.confirmar(id)
      const despues = await s.reservaPorTokenPrivado(r.tokenPrivado)

      expect(despues).toEqual(antes)
    })

    it('rechaza todo el intento si una de sus partes ya fue pagada', async () => {
      const r = await reservarYPagar({
        deporte: 'cornhole',
        partes: 4,
      })

      const pendientes = r.partes
        .filter((p) => !p.pago)
        .map((p) => p.id)

      const intentoCompleto = await s.iniciarPago(
        r.tokenCobro,
        pendientes,
        'Beto',
      )

      const intentoIndividual = await s.iniciarPago(
        r.tokenCobro,
        [r.partes[1].id],
        'Luis',
      )

      await s.pagoSimulado.confirmar(
        intentoIndividual.url.split('/').pop()!,
      )

      await expect(
        s.pagoSimulado.confirmar(
          intentoCompleto.url.split('/').pop()!,
        ),
      ).rejects.toMatchObject({
        codigo: 'datos_invalidos',
      })

      const despues = await s.reservaPorTokenPrivado(r.tokenPrivado)

      expect(despues!.partes[1].pago!.nombre).toBe('Luis')
      expect(despues!.partes[2].pago).toBeNull()
      expect(despues!.partes[3].pago).toBeNull()
    })
  })

  describe('cancelar', () => {
    it('al cancelar, la página del cliente se entera sin recargar', async () => {
      const r = await reservarYPagar({ inicio: h(19) })
      let avisos = 0
      const dejar = s.alCambiar(() => avisos++)
      await s.cancelarComoCliente(r.tokenPrivado)
      dejar()
      expect(avisos).toBeGreaterThan(0)
    })

    it('lo pagado en línea queda por revisar, falte lo que falte; nada se marca devuelto', async () => {
      const a = await reservarYPagar({ inicio: h(19) })
      reloj = instante(VIERNES, h(18, 30))
      const cancelada = await s.cancelarComoCliente(a.tokenPrivado)
      expect(cancelada.estado).toBe('cancelada')
      expect(cancelada.partes[0].pago!.devuelto).toBeUndefined()
      expect(cancelada.devolucion).toEqual({ monto: cancelada.partes[0].monto, estado: 'por_revisar' })
    })
    it('sin pagos en línea no queda devolución que revisar', async () => {
      const r = await s.apartar(pedido())
      expect((await s.cancelarComoCliente(r.tokenPrivado)).devolucion).toBeNull()
    })
    it('el negocio la resuelve: lo transferido deja de contar como cobrado', async () => {
      const a = await reservarYPagar({ inicio: h(19) })
      const b = await reservarYPagar({ inicio: h(20), organizador: { nombre: 'Beto', whatsapp: '6620000009' } })
      await s.cancelarComoCliente(a.tokenPrivado)
      await s.cancelarComoCliente(b.tokenPrivado)

      expect(await codigoDe(s.devolucionesPorRevisar())).toBe('sin_sesion')
      await s.iniciarSesion('recepcion', '')
      expect((await s.devolucionesPorRevisar()).map((r) => r.folio).sort()).toEqual([a.folio, b.folio].sort())

      const transferida = await s.resolverDevolucion(a.id, 'transferida')
      expect(transferida.devolucion).toMatchObject({ estado: 'transferida', por: 'Recepción' })
      expect(transferida.partes[0].pago!.devuelto).toBe(true)
      expect((await s.pagosDelDia(VIERNES)).find((p) => p.folio === a.folio)!.devuelto).toBe(true)

      const sinDevolucion = await s.resolverDevolucion(b.id, 'sin_devolucion')
      expect(sinDevolucion.partes[0].pago!.devuelto).toBeUndefined()

      expect(await s.devolucionesPorRevisar()).toEqual([])
      expect(await codigoDe(s.resolverDevolucion(a.id, 'sin_devolucion'))).toBe('no_permitido')
    })
  })

  describe('panel', () => {
    beforeEach(async () => {
      await s.iniciarSesion('recepcion', '')
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

    it('si alguna de las partes ya se pagó por otro lado, no cobra ninguna y avisa', async () => {
      const r = await reservarYPagar({ deporte: 'cornhole', partes: 4 })
      // Un amigo paga la parte 2 en línea mientras recepción cobra la 2 y la 3.
      await s.marcarPago(r.id, [r.partes[1].id], 'efectivo', 'Amigo')
      expect(await codigoDe(s.marcarPago(r.id, [r.partes[1].id, r.partes[2].id], 'efectivo', 'Grupo'))).toBe('datos_invalidos')
      const despues = (await s.reservasEntre(VIERNES, VIERNES)).find((x) => x.id === r.id)!
      expect(despues.partes[2].pago).toBeNull()
    })

    it('una acción avisa a las pantallas para que vuelvan a cargar', async () => {
      const r = await reservarYPagar({ deporte: 'cornhole', partes: 2 })
      let avisos = 0
      const dejar = s.alCambiar(() => avisos++)
      await s.marcarPago(r.id, [r.partes[1].id], 'efectivo', 'Pedro')
      dejar()
      expect(avisos).toBeGreaterThan(0)
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

    it('cambiar de la promo de las 5 a las 7 cobra la diferencia y quita la etiqueta de promo', async () => {
      const r = await reservarYPagar({ deporte: 'cornhole', inicio: h(17), partes: 1 })
      expect(r.conPromo).toBe(true)
      const movida = await s.cambiarHorario(r.id, VIERNES, h(19))
      expect(movida.conPromo).toBe(false)
      expect(movida.partes.at(-1)).toMatchObject({ concepto: 'cambio', monto: 60 })
    })

    it('extender no deja a dos grupos en la misma mesa: si el siguiente ya está en ella, avisa', async () => {
      const a = await reservarYPagar({ deporte: 'pingpong', inicio: h(19) })
      const b = await reservarYPagar({ deporte: 'pingpong', inicio: h(20), organizador: { nombre: 'Beto', whatsapp: '6620000009' } })
      await s.asignarMesa(a.id, 'PP 1')
      await s.asignarMesa(b.id, 'PP 1')
      expect(await codigoDe(s.extender(a.id, 60))).toBe('no_permitido')
      // Cambiándolos de mesa, ya se puede.
      await s.asignarMesa(a.id, 'PP 2')
      expect((await s.extender(a.id, 60)).duracion).toBe(120)
    })
    it('extender se bloquea si de 8 a 9 están todas las mesas', async () => {
      const a = await reservarYPagar({ inicio: h(19) })
      for (let i = 0; i < 3; i++) await reservarYPagar({ inicio: h(20), organizador: { nombre: 'Grupo' + i, whatsapp: '662000001' + i } })
      expect(await codigoDe(s.extender(a.id, 60))).toBe('sin_lugar')
    })

    it('caja: el cliente sin reserva se cobra al registrarlo, queda quién cobró y sale en el cierre del día', async () => {
      reloj = instante(VIERNES, h(19, 5))
      const r = await s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Mostrador', mesa: 'PP 3', medio: 'tarjeta' })
      expect(r).toMatchObject({ origen: 'mostrador', estado: 'confirmada', mesa: 'PP 3', inicio: h(19, 5), precio: 150 })
      expect(r.partes).toHaveLength(1)
      expect(r.partes[0].pago).toMatchObject({ medio: 'tarjeta', nombre: 'Mostrador', marcadoPor: 'Recepción' })
      const caja = await s.pagosDelDia(VIERNES)
      expect(caja.find((p) => p.reservaId === r.id)).toMatchObject({ monto: 150, medio: 'tarjeta' })
    })
    it('caja: con el local cerrado lo dice; si no alcanza el tiempo, dice a qué hora se cierra', async () => {
      reloj = instante(VIERNES, h(15))
      expect(await codigoDe(s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Temprano', medio: 'efectivo' }))).toBe('fuera_de_horario')
      reloj = instante(VIERNES, h(21, 30))
      await s.anotarSinReserva({ deporte: 'pingpong', duracion: 30, nombre: 'Media hora', medio: 'efectivo' })
      await expect(s.anotarSinReserva({ deporte: 'pingpong', duracion: 60, nombre: 'Tarde', medio: 'efectivo' })).rejects.toThrow('10:00 PM')
    })
    it('caja: no registra si no hay mesa libre todo el tiempo, y no cobra nada', async () => {
      reloj = instante(VIERNES, h(19))
      for (let i = 0; i < 3; i++) await s.anotarSinReserva({ deporte: 'popdarts', duracion: 60, nombre: 'Grupo' + i, medio: 'efectivo' })
      expect(await codigoDe(s.anotarSinReserva({ deporte: 'popdarts', duracion: 60, nombre: 'Otro', medio: 'efectivo' }))).toBe('sin_lugar')
      expect((await s.pagosDelDia(VIERNES)).length).toBe(3)
    })

    it('liberar por retraso solo pasada la tolerancia', async () => {
      const r = await reservarYPagar({
        inicio: h(19),
      })

      reloj = instante(VIERNES, h(19, 29))

      expect(
        await codigoDe(s.liberarPorRetraso(r.id)),
      ).toBe('no_permitido')

      reloj = instante(VIERNES, h(19, 30))

      expect(
        (await s.liberarPorRetraso(r.id)).cancelacion?.motivo,
      ).toBe('no_llego')
    })

    it('el dueño da acceso con usuario y contraseña; el nuevo usuario entra', async () => {
      await s.iniciarSesion('hugo', '')
      expect(await codigoDe(s.agregarUsuario({ nombre: 'Luz', usuario: 'luz rosa', rol: 'recepcion' }, 'secreto123'))).toBe('datos_invalidos')
      expect(await codigoDe(s.agregarUsuario({ nombre: 'Luz', usuario: 'luz', rol: 'recepcion' }, 'corta'))).toBe('datos_invalidos')
      expect(await codigoDe(s.agregarUsuario({ nombre: 'Otra', usuario: 'recepcion', rol: 'recepcion' }, 'secreto123'))).toBe('datos_invalidos')
      const luz = await s.agregarUsuario({ nombre: 'Luz', usuario: 'Luz', rol: 'recepcion' }, 'secreto123')
      expect(luz.usuario).toBe('luz')
      await s.cerrarSesion()
      expect((await s.iniciarSesion(' LUZ ', 'secreto123')).nombre).toBe('Luz')
      expect(await codigoDe(s.agregarUsuario({ nombre: 'X', usuario: 'xxx', rol: 'dueno' }, 'secreto123'))).toBe('no_permitido')
    })

    it('recepción no puede cambiar la configuración; el dueño sí', async () => {
      const config = await s.configuracion()

      expect(
        await codigoDe(s.guardarConfiguracion(config)),
      ).toBe('no_permitido')

      await s.iniciarSesion('hugo', '')

      expect(
        (await s.guardarConfiguracion(config)).guardada,
      ).toBe(true)
    })

    it('quitar mesas con reservas encima avisa y no guarda, salvo que Hugo insista', async () => {
      await s.iniciarSesion('hugo', '')

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

      await s.iniciarSesion('hugo', '')

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
})

describe('datos de ejemplo', () => {
  it('respetan el horario y el inventario: guardar la configuración tal cual no da conflictos', async () => {
    const conEjemplos = crearServicioSimulado({ almacen: almacenEnMemoria(), reloj: () => reloj })
    await conEjemplos.iniciarSesion('hugo', '')
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
describe('disponibilidad del panel fuera de la ventana habitual', () => {
  it.each(['2026-09-01', '2026-12-01'])(
    'revisa la ocupación al mover, asignar y extender en %s',
    async (destino) => {
      const { conexion } = conexionEnMemoria(
        () => instante(VIERNES, h(19)),
      )
      const servicio = crearServicioReal(conexion)

      await servicio.iniciarSesion('hugo', '')

      const config = await servicio.configuracion()
      config.deportes.pingpong.mesas = 1
      await servicio.guardarConfiguracion(config)

      const crear = (nombre: string) =>
        servicio.anotarSinReserva({
          deporte: 'pingpong',
          duracion: 60,
          nombre,
          medio: 'efectivo',
        })

      const primera = await crear('Grupo uno')
      await servicio.cambiarHorario(primera.id, destino, h(19))
      await servicio.asignarMesa(primera.id, 'PP 1')

      const segunda = await crear('Grupo dos')

      // Con una sola mesa, no debe permitir dos grupos al mismo tiempo.
      expect(
        await codigoDe(
          servicio.cambiarHorario(segunda.id, destino, h(19)),
        ),
      ).toBe('sin_lugar')

      // El intento rechazado debe conservar la fecha original.
      expect(
        (await servicio.reservaPorTokenPrivado(segunda.tokenPrivado))?.fecha,
      ).toBe(VIERNES)

      // Tampoco debe extender hacia un horario que ya está ocupado.
      await servicio.cambiarHorario(segunda.id, destino, h(20))

      expect(
        await codigoDe(servicio.extender(primera.id, 30)),
      ).toBe('sin_lugar')

      // Con capacidad para dos grupos, no pueden compartir la misma mesa.
      config.deportes.pingpong.mesas = 2
      await servicio.guardarConfiguracion(config)
      await servicio.cambiarHorario(segunda.id, destino, h(19))

      expect(
        await codigoDe(servicio.asignarMesa(segunda.id, 'PP 1')),
      ).toBe('no_permitido')
    },
  )
})
