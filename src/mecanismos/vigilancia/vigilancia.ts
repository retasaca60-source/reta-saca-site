// Avisar de los errores que sufren los clientes y recepción antes de que
// alguien los reporte con una captura.
//
// El 19/10 el proyecto de Supabase se pausó y el sitio dejó de responder; nos
// enteramos cuando alguien lo dijo. Con esto, cada error llega a Sentry con su
// causa, la pantalla y el teléfono o navegador.
//
// Decisiones, con su porqué:
//
// - **Apagado si no hay llave.** Sin `VITE_SENTRY_DSN` no se carga nada. La
//   demostración no la lleva: sus errores son de pruebas, no de clientes.
// - **No le cuesta el arranque a nadie.** Sentry se carga cuando la página ya
//   abrió y el navegador tiene un respiro. Lo que truene antes se guarda y se
//   manda en cuanto carga.
// - **Nada de datos de la gente.** Los links /r/…, /c/… y /pago/… SON la llave
//   de cada reserva: quien tiene uno puede cancelarla. Se tapan antes de
//   mandar cualquier cosa. De recepción se manda su id y su rol, sin nombre.
// - **Solo errores: sin repetición de la sesión ni medición de rendimiento.**
//   Las dos registran la dirección de cada página por su cuenta, sin pasar
//   por el filtro que tapa los links. Un error con su pantalla y sus pasos
//   previos alcanza para arreglarlo; la llave de la reserva de un cliente no
//   tiene por qué salir.

type Sentry = typeof import('@sentry/react')

let sentry: Sentry | null = null
/** Errores que pasaron antes de que Sentry cargara. */
const pendientes: ((S: Sentry) => void)[] = []
let usuario: { id: string; rol: string } | null = null

const DSN = import.meta.env.VITE_SENTRY_DSN

/**
 * Tapa lo que da acceso: el token de una reserva, de un cobro o de un pago, y
 * llaves en la URL. Se usa también sobre el reporte entero ya convertido a
 * texto: por eso el token termina en comillas, diagonal invertida o espacio.
 * Sin eso se comía el cierre del texto, el reporte quedaba roto y Sentry lo
 * tiraba sin avisar.
 */
export function limpiarUrl(url: string): string {
  return url
    .replace(/\/(r|c|pago)\/[^/?#"'\\\s]+/g, '/$1/[oculto]')
    .replace(/([?&](?:token|apikey|access_token|refresh_token|preference_id|external_reference)=)[^&#"'\\\s]+/gi, '$1[oculto]')
}

function cuandoCargue(f: (S: Sentry) => void) {
  if (!DSN) return
  if (sentry) f(sentry)
  else pendientes.push(f)
}

export function iniciarVigilancia() {
  if (!DSN) return

  const temprano = (e: ErrorEvent) => cuandoCargue((S) => S.captureException(e.error ?? e.message))
  const rechazoTemprano = (e: PromiseRejectionEvent) => cuandoCargue((S) => S.captureException(e.reason))
  window.addEventListener('error', temprano)
  window.addEventListener('unhandledrejection', rechazoTemprano)

  const cargar = async () => {
    try {
      const S = await import('@sentry/react')
      S.init({
        dsn: DSN,
        environment: import.meta.env.VITE_DATOS === 'real' ? 'produccion' : 'demostracion',
        // La fecha de compilación que se ve en el código fuente de la página:
        // así se sabe si un error llegó con la última publicación.
        release: document.querySelector('meta[name=compilacion]')?.getAttribute('content') ?? undefined,
        ignoreErrors: [
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          // Lo da el navegador al interrumpir una transición de pantalla (la
          // pestaña se ocultó a medio cambio): no es un fallo del sitio.
          'Transition was aborted because of invalid state',
        ],
        beforeBreadcrumb(miga) {
          const d = miga.data as Record<string, unknown> | undefined
          if (d) for (const k of ['url', 'to', 'from']) if (typeof d[k] === 'string') d[k] = limpiarUrl(d[k] as string)
          return miga
        },
        // Red de seguridad: se tapa en TODO el reporte, no campo por campo.
        // Un link puede colarse donde no se espera (el mensaje de un error,
        // una miga nueva de una versión futura de Sentry).
        beforeSend: (evento) => JSON.parse(limpiarUrl(JSON.stringify(evento))),
      })
      sentry = S
      if (usuario) {
        S.setUser({ id: usuario.id })
        S.setTag('rol', usuario.rol)
      }
      for (const f of pendientes.splice(0)) f(S)
    } catch {
      // Si Sentry no carga (sin red, un bloqueador), el sitio sigue igual.
      // Vigilar nunca debe tumbar lo que se vigila.
    } finally {
      window.removeEventListener('error', temprano)
      window.removeEventListener('unhandledrejection', rechazoTemprano)
    }
  }

  if ('requestIdleCallback' in window) window.requestIdleCallback(() => void cargar(), { timeout: 5000 })
  else setTimeout(() => void cargar(), 3000)
}

/** Un error atrapado a mano: una pantalla que tronó, una falla inesperada. */
export function reportarError(error: unknown, donde: string) {
  cuandoCargue((S) => S.captureException(error, { tags: { donde } }))
}

/**
 * Fallas que el sitio ya atiende (le muestra un mensaje a la persona) y por
 * eso nunca "truenan": sin esto Sentry no se enteraría. Cada tipo queda como
 * un solo asunto en Sentry, con todos sus casos dentro. Se avisa una vez por
 * tipo y detalle en cada visita, para que un reintento no mande lo mismo
 * cada 30 segundos.
 */
export type TipoDeFalla =
  | 'servidor-no-responde' // la función de Supabase contestó algo que no es nuestro (caída, pausa, límite)
  | 'falla-del-servidor' // la función atrapó un error inesperado ("Algo falló de nuestro lado")

const DESCRIPCION: Record<TipoDeFalla, string> = {
  'servidor-no-responde': 'El servidor (función de Supabase) no respondió bien',
  'falla-del-servidor': 'El servidor tuvo un error inesperado',
}

const yaAvisadas = new Set<string>()

export function reportarFalla(tipo: TipoDeFalla, detalle: Record<string, string | number | null>) {
  const clave = tipo + JSON.stringify(detalle)
  if (yaAvisadas.has(clave)) return
  yaAvisadas.add(clave)
  cuandoCargue((S) =>
    S.captureMessage(DESCRIPCION[tipo], {
      level: 'error',
      fingerprint: ['falla-atendida', tipo],
      tags: { falla: tipo },
      extra: detalle,
    }),
  )
}

/** Quién del panel está usando el sitio: id y rol, sin nombre. `null` al salir. */
export function identificarUsuario(perfil: { id: string; rol: string } | null) {
  usuario = perfil
  if (!sentry) return
  sentry.setUser(perfil ? { id: perfil.id } : null)
  sentry.setTag('rol', perfil?.rol ?? 'cliente')
}
