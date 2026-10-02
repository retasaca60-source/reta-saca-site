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
      // Un error nuestro trae { error: { codigo, mensaje } } con un mensaje
      // para la persona. Cualquier otra cosa (un error de la plataforma con
      // { message }, una página, un código distinto de 2xx sin "resultado") NO
      // es una respuesta: antes se devolvía `undefined` como si lo fuera, y la
      // pantalla se quedaba cargando o tronaba después sin decir por qué.
      const error = cuerpo && typeof cuerpo === 'object' ? cuerpo.error : null
      if (error && typeof error === 'object' && typeof error.mensaje === 'string') {
        throw new ErrorDeDatos(typeof error.codigo === 'string' ? error.codigo : 'datos_invalidos', error.mensaje)
      }
      if (!respuesta.ok || !cuerpo || typeof cuerpo !== 'object' || !('resultado' in cuerpo)) {
        console.error('[api]', accion, respuesta.status, cuerpo)
        throw new ErrorDeDatos('datos_invalidos', `El servidor no respondió bien (${respuesta.status}). Intenta otra vez en un momento.`)
      }
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
