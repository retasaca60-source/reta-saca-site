// Para las pruebas: la versión real del contrato conectada al servidor de
// verdad (servidor/api.ts), con la base en memoria en vez de Postgres y
// sesiones de mentira en vez de Supabase Auth.
//
// Todo pasa por JSON, igual que por la red: si el servidor devolviera algo que
// no sobrevive a la ida y vuelta (un Date, un undefined que importa), las
// pruebas lo notan aquí y no en producción.

import { USUARIOS_DEMO } from '../datos/ejemplos'
import { normalizarUsuario } from '../datos/usuarios'
import { ErrorDeDatos } from '../negocio/errores'
import { CONFIGURACION_INICIAL } from '../negocio/configuracion'
import type { Conexion } from '../datos/real'
import { atender } from './api'
import { repositorioEnMemoria, type Repositorio } from './repositorio'

const porLaRed = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)))

export function conexionEnMemoria(reloj: () => number): { conexion: Conexion; repo: Repositorio } {
  const repo = repositorioEnMemoria(CONFIGURACION_INICIAL)
  // Las cuentas del panel por usuario (en Supabase, las de Auth): de inicio, los
  // mismos usuarios de la demostración.
  const cuentas = new Map(USUARIOS_DEMO.map((u) => [u.usuario, u.id]))
  const perfilesListos = Promise.all(USUARIOS_DEMO.map((u) => repo.guardarPerfil(u)))
  let cuentaId: string | null = null

  const conexion: Conexion = {
    llamar: async (accion, datos) => {
      await perfilesListos
      const r = await atender(
        { accion, datos: porLaRed(datos) },
        {
          repo,
          ahora: reloj,
          cuentaId,
          pagosSimulados: true,
          mercadoPago: null,
          sitio: 'http://localhost:5190',
          cliente: null,
          cuentas: {
            crear: async (usuario) => {
              const id = crypto.randomUUID()
              cuentas.set(usuario, id)
              return id
            },
            borrar: async (id) => {
              for (const [usuario, x] of cuentas) if (x === id) cuentas.delete(usuario)
            },
          },
        },
      )
      if ('error' in r) throw new ErrorDeDatos(r.error.codigo, r.error.mensaje)
      return porLaRed(r.resultado)
    },
    entrar: async (usuario) => {
      const id = cuentas.get(normalizarUsuario(usuario))
      if (!id) throw new ErrorDeDatos('sin_sesion', 'Usuario o contraseña incorrectos.')
      cuentaId = id
    },
    salir: async () => {
      cuentaId = null
    },
    escuchar: () => () => {},
  }
  return { conexion, repo }
}
