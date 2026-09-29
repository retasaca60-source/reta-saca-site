// La Edge Function `api`: la única puerta del sitio y del panel a los datos.
//
// Recibe { accion, datos }, averigua si quien llama tiene sesión del panel, y
// se lo pasa a src/servidor/api.ts, que aplica las reglas y guarda. Este
// archivo solo conecta: Postgres, Supabase Auth y la hora del servidor.
//
// Se empaqueta a supabase/functions/api/index.js con `npm run servidor:empaquetar`
// (las reglas viven en src/ y las Edge Functions no leen fuera de su carpeta).
// La verificación automática de sesión de Supabase va apagada en config.toml:
// el sitio del cliente llama sin sesión, y la sesión del panel se revisa aquí.

import postgres from 'npm:postgres@3.4.9'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { atender, type Peticion } from '../../src/servidor/api'
import { repositorioPostgres } from './postgres'

declare const Deno: {
  env: { get(nombre: string): string | undefined }
  serve(atender: (peticion: Request) => Response | Promise<Response>): void
}

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
/** La llave de servidor: la nueva (SUPABASE_SECRET_KEYS) o, si el proyecto aún la usa, la heredada. */
const LLAVE_SERVIDOR =
  (() => {
    const nuevas = Deno.env.get('SUPABASE_SECRET_KEYS')
    try {
      return nuevas ? (JSON.parse(nuevas).default as string | undefined) : undefined
    } catch {
      return undefined
    }
  })() ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false })
const repo = repositorioPostgres(sql)
const admin = createClient(URL_SUPABASE, LLAVE_SERVIDOR, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * Mientras no haya Mercado Pago, el pago en línea es la pantalla simulada. Se
 * enciende con el secreto PAGOS_SIMULADOS=si; apagado, nadie puede "pagar" en
 * línea (y sin él, nadie puede confirmar una reserva sin pagar de verdad).
 */
const pagosSimulados = Deno.env.get('PAGOS_SIMULADOS') === 'si'

/** A dónde manda el correo de invitación del panel. */
const SITIO = Deno.env.get('SITIO_URL') ?? 'https://reta-saca.netlify.app'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** La cuenta de quien llama, verificada con Supabase Auth; null si llama sin sesión. */
async function cuentaDe(peticion: Request): Promise<string | null> {
  const token = peticion.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  // Sin sesión el navegador no manda token, o manda la llave pública (que no es una sesión).
  if (!token || token.startsWith('sb_')) return null
  const { data, error } = await admin.auth.getUser(token)
  return error || !data.user ? null : data.user.id
}

Deno.serve(async (peticion) => {
  if (peticion.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (peticion.method !== 'POST') return responder({ error: { codigo: 'datos_invalidos', mensaje: 'Método no permitido.' } }, 405)

  let cuerpo: Peticion
  try {
    cuerpo = await peticion.json()
    if (!cuerpo || typeof cuerpo.accion !== 'string') throw new Error()
  } catch {
    return responder({ error: { codigo: 'datos_invalidos', mensaje: 'Petición inválida.' } }, 400)
  }

  const respuesta = await atender(cuerpo, {
    repo,
    ahora: Date.now,
    cuentaId: await cuentaDe(peticion),
    pagosSimulados,
    cuentas: {
      invitar: async (correo) => {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(correo, { redirectTo: `${SITIO}/panel` })
        if (error || !data.user) throw error ?? new Error('No se pudo invitar')
        return data.user.id
      },
      borrar: async (id) => {
        const { error } = await admin.auth.admin.deleteUser(id)
        if (error) throw error
      },
    },
  })
  return responder(respuesta)
})
