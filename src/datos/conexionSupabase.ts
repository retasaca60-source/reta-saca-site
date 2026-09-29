// Cómo habla el navegador con Supabase en la versión real.
//
// Todo pasa por la Edge Function `api`: el navegador no lee ni escribe tablas.
// Lo que sí usa directo es Supabase Auth (la sesión del panel) y Realtime
// (el aviso de "cambió una reserva" para la laptop de recepción).
//
// La URL y la llave PUBLICABLE del proyecto son públicas por diseño (van dentro
// del sitio): no abren nada que la función no deje. La llave secreta nunca
// sale de Supabase.

import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { ErrorDeDatos } from './contrato'
import type { Conexion } from './real'
import { correoInterno } from './usuarios'

export function conexionSupabase(url: string, llavePublica: string): Conexion {
  const supabase = createClient(url, llavePublica)
  const oyentes = new Set<() => void>()
  const avisar = () => oyentes.forEach((f) => f())

  // Un solo canal de Realtime para toda la página, y solo con sesión del panel:
  // el cliente del sitio no lo necesita (y la base no le dejaría ver nada).
  let canal: RealtimeChannel | null = null
  const encenderCanal = () => {
    canal ??= supabase
      .channel('reservas-del-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, avisar)
      .subscribe()
  }
  const apagarCanal = () => {
    if (canal) void supabase.removeChannel(canal)
    canal = null
  }

  supabase.auth.onAuthStateChange((evento, sesion) => {
    // Supabase pide no llamar a su cliente dentro de este aviso: se difiere.
    setTimeout(() => {
      if (sesion) encenderCanal()
      else apagarCanal()
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') avisar()
    }, 0)
  })

  // Al volver a la pestaña (el teléfono estuvo bloqueado, la laptop dormida) se
  // recarga: lo que pasó mientras tanto no llegó por Realtime.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && avisar())
  }

  return {
    llamar: async (accion, datos) => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      let respuesta: Response
      try {
        respuesta = await fetch(`${url}/functions/v1/api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: llavePublica,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ accion, datos }),
        })
      } catch {
        throw new ErrorDeDatos('datos_invalidos', 'No hay conexión. Revisa tu internet e intenta otra vez.')
      }
      const cuerpo = await respuesta.json().catch(() => null)
      if (!cuerpo || typeof cuerpo !== 'object') {
        throw new ErrorDeDatos('datos_invalidos', 'El servidor no respondió bien. Intenta otra vez en un momento.')
      }
      if (cuerpo.error) throw new ErrorDeDatos(cuerpo.error.codigo, cuerpo.error.mensaje)
      return cuerpo.resultado
    },

    entrar: async (usuario, contrasena) => {
      const { error } = await supabase.auth.signInWithPassword({ email: correoInterno(usuario), password: contrasena })
      if (error) throw new ErrorDeDatos('sin_sesion', 'Usuario o contraseña incorrectos.')
    },

    salir: async () => {
      await supabase.auth.signOut()
    },

    escuchar: (aviso) => {
      oyentes.add(aviso)
      return () => void oyentes.delete(aviso)
    },
  }
}
