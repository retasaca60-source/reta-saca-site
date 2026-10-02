// Lo del servidor que no se ve desde el contrato: que un alta a medias se
// deshaga y que la base de pruebas se comporte como Postgres al fallar.

import { describe, expect, it } from 'vitest'
import { USUARIOS_DEMO } from '../datos/ejemplos'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
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
