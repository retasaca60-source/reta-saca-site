// Lo del servidor que no se ve desde el contrato: que un alta a medias se
// deshaga y que la base de pruebas se comporte como Postgres al fallar.

import { describe, expect, it } from 'vitest'
import { USUARIOS_DEMO } from '../datos/ejemplos'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import type { Reserva } from '../negocio/reserva'
import { instante } from '../negocio/tiempo'
import { atender, type Entorno } from './api'
import { repositorioEnMemoria } from './repositorio'

const dueno = USUARIOS_DEMO.find((u) => u.rol === 'dueno')!

describe('servidor', () => {
  it('16. si falla el perfil, la cuenta recién creada se borra y el alta se puede repetir', async () => {
    const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
    await repo.guardarPerfil(dueno)
    const cuentas = new Set<string>()
    let fallar = true
    const guardar = repo.guardarPerfil
    repo.guardarPerfil = async (u) => {
      if (fallar) throw new Error('la base no contestó')
      return guardar(u)
    }
    const entorno: Entorno = {
      repo,
      ahora: Date.now,
      cuentaId: dueno.id,
      pagosSimulados: false,
      mercadoPago: null,
      sitio: '',
      cliente: null,
      cuentas: {
        crear: async (usuario) => {
          if (cuentas.has(usuario)) throw new Error('ya existe')
          cuentas.add(usuario)
          return usuario
        },
        borrar: async (id) => void cuentas.delete(id),
      },
    }
    const alta = () => atender({ accion: 'agregarUsuario', datos: { usuario: { nombre: 'Rosa', usuario: 'rosa', rol: 'recepcion' }, contrasena: 'una-contrasena' } }, entorno)
    expect('error' in (await alta())).toBe(true)
    expect(cuentas.size).toBe(0)
    fallar = false
    expect('resultado' in (await alta())).toBe(true)
    expect((await repo.perfiles()).map((u) => u.usuario)).toContain('rosa')
  })

  it('26. una transacción que falla no deja nada de lo que escribió', async () => {
    const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
    const otra = structuredClone(CONFIGURACION_INICIAL)
    otra.deportes.pingpong.mesas = 1
    await expect(
      repo.enTransaccion(async (r) => {
        await r.guardarConfig(otra)
        await r.guardarPerfil(dueno)
        throw new Error('falla a la mitad')
      }),
    ).rejects.toThrow('falla a la mitad')
    expect((await repo.config()).deportes.pingpong.mesas).toBe(6)
    expect(await repo.perfiles()).toEqual([])
  })
})

  it('el pago simulado revisa el cupo del día de la reserva aunque esté a más de 30 días', async () => {
    const recepcion = USUARIOS_DEMO.find((u) => u.rol === 'recepcion')!
    const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
    await repo.guardarPerfil(recepcion)
    let ahora = instante('2026-10-19', 15 * 60)
    const entorno: Entorno = {
      repo, ahora: () => ahora, cuentaId: null, pagosSimulados: true, mercadoPago: null, sitio: '', cliente: null,
      cuentas: { crear: async () => '', borrar: async () => {} },
    }
    const llamar = async <T,>(accion: string, datos: Record<string, unknown>, cuentaId: string | null = null): Promise<T> => {
      const r = await atender({ accion, datos }, { ...entorno, cuentaId })
      if ('error' in r) throw Object.assign(new Error(r.error.mensaje), { codigo: r.error.codigo })
      return r.resultado as T
    }
    const apartar = (fecha: string, inicio: number, whatsapp: string) =>
      llamar<Reserva>('apartar', { solicitud: { deporte: 'popdarts', fecha, inicio, duracion: 60, partes: 1, organizador: { nombre: 'Grupo', whatsapp } } })
    const iniciar = async (r: Reserva) => (await llamar<{ url: string }>('iniciarPago', { token: r.tokenPrivado, parteIds: [r.partes[0].id], nombre: '' })).url.split('/').pop()!
    const mover = (r: Reserva, fecha: string) => llamar('cambiarHorario', { reservaId: r.id, fecha, inicio: 19 * 60 }, recepcion.id)
    const LEJOS = '2026-12-04' // a 46 días: fuera de la ventana de 30

    // A empieza a pagar y recepción la mueve a diciembre; su apartado vence sin pagar.
    const a = await apartar('2026-10-19', 19 * 60, '6620000001')
    const pagoDeA = await iniciar(a)
    await mover(a, LEJOS)
    // Otros tres grupos pagan y recepción los pasa a ese mismo horario: Popdarts tiene 3 mesas.
    const otros = []
    for (const [i, inicio] of [17, 18, 19].entries()) {
      const r = await apartar('2026-10-20', inicio * 60, `662000001${i}`)
      await llamar('pagoSimuladoConfirmar', { id: await iniciar(r) })
      otros.push(r)
    }
    ahora += 11 * 60_000
    for (const r of otros) await mover(r, LEJOS)

    // El pago tardío de A ya no tiene mesa: no se confirma.
    await expect(llamar('pagoSimuladoConfirmar', { id: pagoDeA })).rejects.toMatchObject({ codigo: 'apartado_vencido' })
    const confirmadas = (await repo.reservasEntre(LEJOS, LEJOS)).filter((r) => r.estado === 'confirmada')
    expect(confirmadas).toHaveLength(3)
  })