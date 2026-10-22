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
import { correoInterno } from '../../src/datos/usuarios'
import { atender, registrarPagoEnLinea, type Entorno, type Peticion } from '../../src/servidor/api'
import { clipReal } from './clip'
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
 * Mientras no haya pasarela (Clip), el pago en línea es la pantalla simulada. Se
 * enciende con el secreto PAGOS_SIMULADOS=si; apagado, nadie puede "pagar" en
 * línea (y sin él, nadie puede confirmar una reserva sin pagar de verdad).
 */
const pagosSimulados = Deno.env.get('PAGOS_SIMULADOS') === 'si'

/**
 * Con la llave de Clip (CLIP_API_KEY) el pago en línea es de verdad y la
 * pantalla simulada deja de funcionar. Clip avisa de cada cobro a esta misma
 * función, con ?aviso=clip. Mercado Pago se quitó el 21/10/2026: su secreto
 * MP_ACCESS_TOKEN ya no se lee y se puede borrar.
 */
const llaveClip = Deno.env.get('CLIP_API_KEY')
const pasarela = llaveClip ? clipReal(llaveClip, { avisoA: `${URL_SUPABASE}/functions/v1/api?aviso=clip` }) : null

/**
 * A dónde regresa quien paga. Se toma del navegador solo si es uno de estos:
 * si no, cualquiera podría crear un cobro que, al pagar, mande a su página.
 * El primero es el de siempre; al cambiar de dominio se agrega aquí.
 */
// Un nombre de Netlify que se deja de usar queda libre para cualquiera: se
// quita de aquí el mismo día (retasaca-hmo pasó a retasaca-hmo2 el 30/09).
const SITIOS = ['https://retasaca-hmo2.netlify.app', 'https://reta-saca.netlify.app', 'https://retasaca.com', 'https://www.retasaca.com']
function sitioDe(peticion: Request): string {
  const origen = peticion.headers.get('origin') ?? ''
  if (SITIOS.includes(origen) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origen)) return origen
  return SITIOS[0]
}

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

/**
 * La dirección de quien llama, para el límite de frecuencia. Se toma la
 * PRIMERA de x-forwarded-for: si la plataforma de Supabase la agrega al final
 * en vez de reemplazarla, alguien podría inventar la primera y saltarse el
 * límite, pero nunca se castiga a un cliente real por la dirección de otro.
 * Tomar la última arriesga lo contrario (que sea la de un proxy interno y
 * todos los clientes compartan contador), y eso dejaría el sitio sin reservas.
 */
function clienteDe(peticion: Request): string | null {
  const ip = peticion.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip && ip.length <= 64 ? ip : null
}

/** Lo que no cambia entre peticiones. */
const entornoBase: Omit<Entorno, 'cuentaId' | 'sitio' | 'cliente'> = {
  repo,
  ahora: Date.now,
  pagosSimulados,
  pasarela,
  cuentas: {
    // Cuenta ya confirmada y con su contraseña: no se manda ningún correo.
    crear: async (usuario, contrasena) => {
      const { data, error } = await admin.auth.admin.createUser({ email: correoInterno(usuario), password: contrasena, email_confirm: true })
      if (error || !data.user) throw error ?? new Error('No se pudo crear la cuenta')
      return data.user.id
    },
    borrar: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id)
      // Si ya no existe, el resultado es el que se buscaba: que no haya cuenta.
      // Así un perfil que se quedó sin su cuenta todavía se puede quitar.
      if (error && error.status !== 404) throw error
    },
  },
}

/**
 * El aviso de Clip: un JSON con `payment_request_id`, el recurso (CHECKOUT o
 * REFUND) y su estado. No se le cree: Clip no firma sus avisos, así que
 * registrarPagoEnLinea pregunta por ese cobro a Clip con nuestra llave y un
 * aviso inventado no confirma nada. Se contesta 200 aunque no sea un cobro
 * nuestro; 500 solo si Clip o la base no contestaron, para que lo reintente.
 */
async function avisoDeClip(peticion: Request, entorno: Entorno): Promise<Response> {
  let cuerpo: { payment_request_id?: unknown; resource?: unknown } = {}
  try {
    cuerpo = await peticion.json()
  } catch {
    return new Response('ok', { headers: CORS })
  }
  const id = typeof cuerpo.payment_request_id === 'string' ? cuerpo.payment_request_id : ''
  if (cuerpo.resource !== 'CHECKOUT' || !id) return new Response('ok', { headers: CORS })
  try {
    await registrarPagoEnLinea(id, entorno)
    return new Response('ok', { headers: CORS })
  } catch (e) {
    console.error('[clip] aviso', id, e)
    return new Response('reintenta', { status: 500, headers: CORS })
  }
}

Deno.serve(async (peticion) => {
  if (peticion.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (peticion.method !== 'POST') return responder({ error: { codigo: 'datos_invalidos', mensaje: 'Método no permitido.' } }, 405)
  const aviso = new URL(peticion.url).searchParams.get('aviso')
  if (aviso === 'clip') return avisoDeClip(peticion, { ...entornoBase, cuentaId: null, sitio: SITIOS[0], cliente: null })
  // Mercado Pago ya no se usa: si todavía avisa de un cobro viejo, se le
  // contesta que sí para que deje de reintentar.
  if (aviso === 'mercadopago') return new Response('ok', { headers: CORS })

  let cuerpo: Peticion
  try {
    cuerpo = await peticion.json()
    if (!cuerpo || typeof cuerpo.accion !== 'string') throw new Error()
  } catch {
    return responder({ error: { codigo: 'datos_invalidos', mensaje: 'Petición inválida.' } }, 400)
  }

  const respuesta = await atender(cuerpo, {
    ...entornoBase,
    cuentaId: await cuentaDe(peticion),
    sitio: sitioDe(peticion),
    cliente: clienteDe(peticion),
  })
  return responder(respuesta)
})
