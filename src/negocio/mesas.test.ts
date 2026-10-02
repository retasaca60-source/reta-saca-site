import { beforeEach, describe, expect, it } from 'vitest'
import { CONFIGURACION_INICIAL } from './configuracion'
import { apartar } from './operaciones/cliente'
import { asignarMesa, extender, marcarPago } from './operaciones/panel'
import type { Contexto } from './operaciones/contexto'
import { instante } from './tiempo'

const FECHA = '2026-09-25'
let ctx: Contexto

function crear(nombre: string, inicio = 19 * 60) {
  const r = apartar(ctx, {
    deporte: 'pingpong',
    fecha: FECHA,
    inicio,
    duracion: 60,
    partes: 1,
        organizador: {
      nombre,
      whatsapp: `662${String(ctx.reservas.length + 1).padStart(7, '0')}`,
    },
  })

  ctx.reservas = [...ctx.reservas, r]
  return r
}

function guardar(r: ReturnType<typeof crear>) {
  ctx.reservas = ctx.reservas.map((x) => x.id === r.id ? r : x)
}

beforeEach(() => {
  ctx = {
    config: structuredClone(CONFIGURACION_INICIAL),
    reservas: [],
    ahora: instante(FECHA, 15 * 60),
  }
})

describe('asignación de mesas con apartados', () => {
  it('un apartado vigente impide asignar la misma mesa a otro grupo', () => {
    const primera = crear('Grupo uno')
    const segunda = crear('Grupo dos')
    guardar(asignarMesa(ctx, primera, 'PP 1'))

    expect(
      () => asignarMesa(ctx, segunda, 'PP 1'),
    ).toThrow('ya la tiene')

    expect(asignarMesa(ctx, segunda, 'PP 2').mesa).toBe('PP 2')

    const siguiente = crear('Grupo siguiente', 20 * 60)
    expect(asignarMesa(ctx, siguiente, 'PP 1').mesa).toBe('PP 1')
  })

  it('un apartado vencido deja de bloquear su mesa asignada', () => {
    const primera = crear('Grupo uno')
    guardar(asignarMesa(ctx, primera, 'PP 1'))

    ctx.ahora = primera.apartadaHasta!

    const segunda = crear('Grupo dos')
    expect(asignarMesa(ctx, segunda, 'PP 1').mesa).toBe('PP 1')
  })

  it('no extiende hacia un apartado vigente en la misma mesa', () => {
    const primera = crear('Grupo uno')
    const sentada = asignarMesa(ctx, primera, 'PP 1')

    const confirmada = marcarPago(
      ctx,
      sentada,
      [sentada.partes[0].id],
      'efectivo',
      undefined,
      'Recepción',
    )
    guardar(confirmada)

    const siguiente = crear('Grupo siguiente', 20 * 60)
    guardar(asignarMesa(ctx, siguiente, 'PP 1'))

    expect(
      () => extender(ctx, confirmada, 30),
    ).toThrow('la tiene')
  })

  it('rechaza el cobro si había una asignación duplicada guardada', () => {
    const primera = crear('Grupo uno')
    guardar(asignarMesa(ctx, primera, 'PP 1'))

    const segunda = crear('Grupo dos')
    const duplicada = { ...segunda, mesa: 'PP 1' }
    guardar(duplicada)

    expect(() => marcarPago(
      ctx,
      duplicada,
      [duplicada.partes[0].id],
      'efectivo',
      undefined,
      'Recepción',
    )).toThrow('Cambia la mesa')

    expect(duplicada.estado).toBe('apartada')
    expect(duplicada.partes[0].pago).toBeNull()
  })
})