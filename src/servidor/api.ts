// EL SERVIDOR: recibe una petición ("apartar", "extender"…), revisa quién la
// hace, llama a la regla de negocio/operaciones y guarda.
//
// Corre en una Edge Function de Supabase (supabase/functions/api), con la hora
// del servidor y con permisos de base de datos que el navegador nunca tiene.
// Aquí no hay reglas de negocio: esas viven en negocio/operaciones, las mismas
// que usa la versión simulada. Lo que sí vive aquí es lo que el navegador no
// puede decidir: quién es quién, la hora, y que todo lo que ocupa mesa se
// revise y guarde en una sola transacción.

import type { IntentoDePago, Rol, Usuario } from '../datos/contrato'
import { MINIMO_CONTRASENA, normalizarUsuario, usuarioValido } from '../datos/usuarios'
import { esDeporteVigente, type Configuracion, type DeporteId, type Duracion, type Modalidad } from '../negocio/configuracion'
import { ErrorDeDatos, MENSAJE_INESPERADO, type CodigoDeError } from '../negocio/errores'
import { formatoDinero } from '../negocio/formato'
import { nuevoFolio, nuevoId } from '../negocio/identificadores'
import * as op from '../negocio/operaciones'
import type { ClienteSinReserva, SolicitudDeReserva } from '../negocio/operaciones'
import type { MedioDePago, Reserva } from '../negocio/reserva'
import { esFechaValida, instante, momentoDe, sumarDias } from '../negocio/tiempo'
import { FolioRepetido, type Repositorio } from './repositorio'

/** Alta y baja de cuentas del panel (Supabase Auth). */
export interface Cuentas {
  /** Crea la cuenta ya confirmada, con esa contraseña, y devuelve su id. */
  crear(usuario: string, contrasena: string): Promise<string>
  borrar(id: string): Promise<void>
}

/**
 * Lo que se le pide a la pasarela de pago. Desde el 21/10/2026 es Clip
 * (supabase/fuentes/clip.ts); antes fue Mercado Pago. Las reglas no dependen
 * de cuál sea: crear un cobro y preguntar por él.
 */
export interface Pasarela {
  /** Crea el cobro y devuelve a dónde mandar a quien paga y el id del cobro en la pasarela. */
  crearCobro(c: CobroNuevo): Promise<{ url: string; cobroId: string }>
  /** Pregunta por un cobro directamente a la pasarela. null si no existe. */
  consultarCobro(cobroId: string): Promise<PagoEnLinea | null>
}

export interface CobroNuevo {
  /** El id del intento: la pasarela lo devuelve como referencia del cobro. */
  intentoId: string
  titulo: string
  monto: number
  /** URL completa a la que regresa al terminar, sin parámetros. */
  volverA: string
  /** Hasta cuándo se puede pagar (ms). Coincide con el bloqueo de las partes. */
  venceEn: number | null
}

export interface PagoEnLinea {
  /** El id del cobro en la pasarela. Con él se apunta que ya se registró. */
  id: string
  /** Si la pasarela ya lo da por pagado. */
  pagado: boolean
  /** La referencia con la que se creó el cobro: el id del intento. */
  referencia: string | null
  monto: number
  moneda: string
}

export interface Entorno {
  repo: Repositorio
  /** Hora del servidor en ms. */
  ahora: () => number
  /** Id de la cuenta que hace la petición, ya verificado contra Supabase Auth, o null. */
  cuentaId: string | null
  cuentas: Cuentas
  /**
   * Mientras no haya pasarela, el pago en línea es la pantalla simulada
   * (/pago/<id>). Con la pasarela conectada se ignora: si no, cualquiera
   * podría confirmar desde la pantalla simulada un cobro que nunca pagó.
   */
  pagosSimulados: boolean
  /** Clip, si hay llave (CLIP_API_KEY). */
  pasarela: Pasarela | null
  /** De dónde viene quien paga ("https://…"), para que la pasarela lo regrese ahí. */
  sitio: string
  /** La dirección (IP) de quien llama, para el límite de frecuencia. null si no se sabe. */
  cliente: string | null
}

/** La pantalla simulada solo existe mientras no haya pasarela de verdad. */
const conPagoSimulado = (e: Entorno) => e.pagosSimulados && !e.pasarela

export interface Peticion {
  accion: string
  datos?: Record<string, unknown>
}

export type Respuesta = { resultado: unknown } | { error: { codigo: CodigoDeError; mensaje: string } }

/**
 * Atiende una petición. Nunca lanza: los errores esperados salen como
 * `{ error }` con el mensaje para la persona; los inesperados, con uno genérico
 * (el detalle se queda en el registro del servidor).
 */
export async function atender(p: Peticion, entorno: Entorno): Promise<Respuesta> {
  const accion = ACCIONES[p.accion]
  if (!accion) return { error: { codigo: 'datos_invalidos', mensaje: 'Esa acción no existe.' } }
  try {
    // Siempre con "resultado", aunque sea null: el navegador lo exige para
    // distinguir una respuesta de un error de la plataforma.
    return { resultado: (await accion(p.datos ?? {}, entorno)) ?? null }
  } catch (e) {
    if (e instanceof ErrorDeDatos) return { error: { codigo: e.codigo, mensaje: e.message } }
    console.error('[api]', p.accion, e)
    return { error: { codigo: 'datos_invalidos', mensaje: MENSAJE_INESPERADO } }
  }
}

// ─── Lectura segura de lo que manda el navegador ─────────────────────────
//
// Todo lo que llega es texto que cualquiera pudo escribir: se revisa el tipo de
// cada campo antes de pasarlo a una regla.

type Datos = Record<string, unknown>
const invalido = (campo: string) => new ErrorDeDatos('datos_invalidos', `Falta o no es válido: ${campo}.`)

function texto(d: Datos, campo: string, opcional = false): string {
  const v = d[campo]
  if (v === undefined && opcional) return ''
  if (typeof v !== 'string' || v.length > 500) throw invalido(campo)
  return v
}
function numero(d: Datos, campo: string): number {
  const v = d[campo]
  if (typeof v !== 'number' || !Number.isFinite(v)) throw invalido(campo)
  return v
}
function textos(d: Datos, campo: string): string[] {
  const v = d[campo]
  if (!Array.isArray(v) || v.length > 20 || !v.every((x) => typeof x === 'string')) throw invalido(campo)
  return v as string[]
}
function fecha(d: Datos, campo: string): string {
  const v = texto(d, campo)
  if (!esFechaValida(v)) throw invalido(campo)
  return v
}
function deporte(d: Datos, campo = 'deporte'): DeporteId {
  const v = texto(d, campo)
  if (!esDeporteVigente(v)) throw invalido(campo)
  return v
}
/** Sin el campo es la estándar: así siguen funcionando las peticiones de antes. */
function modalidad(d: Datos, campo = 'modalidad'): Modalidad {
  const v = d[campo]
  if (v === undefined || v === 'estandar') return 'estandar'
  if (v !== 'pareja') throw invalido(campo)
  return v
}
function siONo(d: Datos, campo: string): boolean {
  const v = d[campo]
  if (v === undefined) return false
  if (typeof v !== 'boolean') throw invalido(campo)
  return v
}
function duracion(d: Datos, campo = 'duracion'): Duracion {
  const v = numero(d, campo)
  if (v !== 30 && v !== 60 && v !== 90 && v !== 120) throw invalido(campo)
  return v
}
function medioDelLocal(d: Datos, campo = 'medio'): Exclude<MedioDePago, 'en_linea'> {
  const v = texto(d, campo)
  if (v !== 'efectivo' && v !== 'tarjeta') throw invalido(campo)
  return v
}

// ─── Ayudas ──────────────────────────────────────────────────────────────

/**
 * Para una operación sobre una reserva, consulta su fecha concreta, aunque
 * quede fuera de la ventana habitual. Sin fecha concreta, carga la ventana
 * de trabajo del sitio. Así no se revisa disponibilidad con reservas ausentes.
 */
async function contexto(
  entorno: Entorno,
  repo = entorno.repo,
  fechaObjetivo?: string,
): Promise<op.Contexto> {
  const config = await repo.config()
  const ahora = entorno.ahora()
  const hoy = momentoDe(ahora).fecha

  const desde = fechaObjetivo ?? sumarDias(hoy, -1)
  const hasta = fechaObjetivo ?? sumarDias(
    hoy,
    Math.max(config.reglas.diasDeAnticipacion, 30),
  )

  const reservas = (await repo.reservasEntre(desde, hasta)).map(
    (r) => op.vencerApartado(r, ahora) ?? r,
  )

  return { config, reservas, ahora }
}

const noEncontrada = () => new ErrorDeDatos('no_encontrada', 'No se encontró la reserva.')

async function reservaPor(repo: Repositorio, campo: 'id' | 'tokenPrivado' | 'tokenCobro', valor: string, ahora: number): Promise<Reserva> {
  const r = await repo.reservaPor(campo, valor)
  if (!r) throw noEncontrada()
  return op.vencerApartado(r, ahora) ?? r
}

/** Guarda una reserva NUEVA; si el folio ya existe (muy raro), saca otro. */
async function guardarNueva(repo: Repositorio, r: Reserva): Promise<Reserva> {
  for (let intento = 0; intento < 5; intento++) {
    try {
      await repo.guardar(r)
      return r
    } catch (e) {
      if (!(e instanceof FolioRepetido)) throw e
      r.folio = nuevoFolio()
    }
  }
  throw new Error('No se pudo generar un folio único')
}

async function usuarioDe(entorno: Entorno): Promise<Usuario> {
  const u = entorno.cuentaId ? await entorno.repo.perfil(entorno.cuentaId) : null
  if (!u) throw new ErrorDeDatos('sin_sesion', 'Tu sesión terminó. Vuelve a entrar.')
  return u
}

async function dueno(entorno: Entorno): Promise<Usuario> {
  const u = await usuarioDe(entorno)
  if (u.rol !== 'dueno') throw new ErrorDeDatos('no_permitido', 'Solo el dueño puede hacer esto.')
  return u
}

/** Lee, revisa y guarda dentro de la misma transacción y para la fecha afectada. */
function enPanel(
  f: (d: Datos, ctx: op.Contexto, r: Reserva, quien: Usuario) => Reserva,
  fechaObjetivo?: (d: Datos) => string,
) {
  return async (d: Datos, entorno: Entorno) => {
    const quien = await usuarioDe(entorno)
    const id = texto(d, 'reservaId')

    return entorno.repo.enTransaccion(async (repo) => {
      const guardada = await repo.reservaPor('id', id)
      if (!guardada) throw noEncontrada()

      // Al mover se revisa el destino; al extender o asignar mesa, su fecha actual.
      const dia = fechaObjetivo ? fechaObjetivo(d) : guardada.fecha

      const ctx = await contexto(entorno, repo, dia)
      const r = op.vencerApartado(guardada, ctx.ahora) ?? guardada

      const nueva = f(d, ctx, r, quien)
      await repo.guardar(nueva)

      return nueva
    })
  }
}

/**
 * Registra un cobro de la pasarela (Clip): lo usan el aviso de Clip y el
 * regreso de quien pagó, y da igual cuál llegue primero o si llegan los dos.
 *
 * Nada de lo que manda quien llama se cree: con el id se le pregunta a la
 * pasarela, y solo cuenta un cobro pagado, en pesos, por el monto exacto del
 * intento. Lanza si la pasarela no contesta, para que el aviso se reintente;
 * lo demás (un id que no es nuestro, un cobro sin pagar) se ignora.
 *
 * Cada cobro se apunta por su id: el mismo cobro que llega dos veces (aviso y
 * regreso) se registra una sola vez.
 */
export async function registrarPagoEnLinea(cobroId: string, e: Entorno): Promise<void> {
  if (!e.pasarela || !/^[\w-]{1,64}$/.test(cobroId)) return
  const pago = await e.pasarela.consultarCobro(cobroId)
  if (!pago || !pago.pagado || !pago.referencia) return
  const referencia = pago.referencia
  await e.repo.enTransaccion(async (repo) => {
    const intento = await repo.intento(referencia)
    if (!intento) return
    if (pago.monto !== intento.monto || pago.moneda !== 'MXN') {
      console.error('[pasarela] el cobro no coincide con su intento', pago.id, intento.id)
      return
    }
    const yaRegistrados = await repo.pagosRegistrados(intento.id)
    if (yaRegistrados.includes(pago.id)) return
    if (intento.resultado === 'pagado' && yaRegistrados.length === 0) {
      // Pagado antes de que se apuntaran los ids: se da por hecho que es ese
      // mismo pago (un aviso repetido), no uno nuevo. Así no se abre una
      // devolución falsa para los cobros viejos.
      await repo.registrarPago(pago.id, intento.id)
      return
    }
    const guardada = await repo.reservaPor('id', intento.reservaId)
    if (!guardada) throw noEncontrada()
    await repo.registrarPago(pago.id, intento.id)

    if (intento.resultado === 'pagado') {
      await repo.guardar(
        op.pagoSinLugar(
          op.vencerApartado(guardada, e.ahora()) ?? guardada,
          intento.monto,
          `${intento.nombre} pagó ${formatoDinero(intento.monto)} dos veces en línea por el mismo cobro (cobro ${pago.id} de Clip).`,
        ),
      )
      return
    }

    // La reserva pudo moverse fuera de la ventana habitual: se revisa el
    // cupo de su fecha actual para no confirmar sobre mesas ya ocupadas.
    const ctx = await contexto(e, repo, guardada.fecha)
    const r = op.vencerApartado(guardada, ctx.ahora) ?? guardada
    try {
      await repo.guardar(op.confirmarPagoEnLinea(ctx, r, intento.parteIds, intento.nombre))
    } catch (error) {
      if (!(error instanceof ErrorDeDatos)) throw error
      // La pasarela ya cobró, pero la mesa se fue o alguien pagó esas partes
      // antes: el dinero entró y queda por devolver, como una cancelación.
      // La nota no copia el mensaje del error: ese le habla a quien paga ("no
      // se hizo ningún cobro") y aquí el cobro sí se hizo.
      const motivo =
        error.codigo === 'fuera_de_horario'
          ? 'el horario de la reserva ya no estaba disponible'
          : error.codigo === 'apartado_vencido'
            ? 'el apartado ya se había vencido y la mesa estaba ocupada'
            : 'esas partes ya estaban pagadas o la reserva estaba cancelada'
      await repo.guardar(op.pagoSinLugar(r, intento.monto, `${intento.nombre} pagó ${formatoDinero(intento.monto)} en línea, pero ${motivo}.`))
    }
    await repo.cerrarIntento(intento.id, 'pagado')
  })
}

/**
 * Límite por dirección para lo que cualquiera puede hacer sin sesión y cuesta
 * algo: apartar ocupa una mesa 10 minutos, iniciar un pago crea un cobro en
 * la pasarela. Holgado a propósito: en México muchos celulares salen a
 * internet por la misma dirección de la compañía, y un grupo reservando desde
 * el wifi del local también. Lo que frena es el bucle de un script, no a un
 * cliente. Sin dirección conocida no se limita (nunca castigar a ciegas).
 */
const LIMITES = { apartar: 20, iniciarPago: 30 } as const
const VENTANA_DE_LIMITE = 10 * 60_000

async function frenar(e: Entorno, accion: keyof typeof LIMITES): Promise<void> {
  if (!e.cliente) return
  const ventana = Math.floor(e.ahora() / VENTANA_DE_LIMITE) * VENTANA_DE_LIMITE
  let n: number
  try {
    n = await e.repo.contarIntento(`${accion}:${e.cliente}`, ventana)
  } catch (error) {
    // Si el contador falla, se deja pasar: un freno descompuesto no puede
    // dejar al local sin reservas. Queda en el registro para arreglarlo.
    console.error('[limite] no se pudo contar', accion, error)
    return
  }
  if (n > LIMITES[accion]) {
    throw new ErrorDeDatos('demasiados_intentos', 'Hubo demasiados intentos desde tu conexión. Espera unos minutos e intenta de nuevo.')
  }
}

// ─── Las acciones ────────────────────────────────────────────────────────

type Accion = (d: Datos, entorno: Entorno) => Promise<unknown>

const ACCIONES: Record<string, Accion> = {
  // ── Cliente (sin sesión) ──

  configuracion: async (_d, e) => e.repo.config(),

  disponibilidad: async (d, e) => op.horariosDisponibles(await contexto(e), deporte(d), fecha(d, 'fecha'), duracion(d), modalidad(d)),

  apartar: async (d, e) => {
    await frenar(e, 'apartar')
    const s = d.solicitud as Datos | undefined
    if (!s || typeof s !== 'object') throw invalido('solicitud')
    const org = s.organizador as Datos | undefined
    if (!org || typeof org !== 'object') throw invalido('organizador')
    // Desde el 21/10/2026 se paga completo. Una versión vieja del sitio
    // (guardada en el teléfono) podría pedir dividir: se le dice que recargue.
    if (s.partes !== undefined && s.partes !== 1) {
      throw new ErrorDeDatos('datos_invalidos', 'Ya no se divide el pago: se paga completo al reservar. Recarga la página.')
    }
    const solicitud: SolicitudDeReserva = {
      deporte: deporte(s),
      fecha: fecha(s, 'fecha'),
      inicio: numero(s, 'inicio'),
      duracion: duracion(s),
      modalidad: modalidad(s),
      palasExtra: siONo(s, 'palasExtra'),
      organizador: { nombre: texto(org, 'nombre'), whatsapp: texto(org, 'whatsapp') },
    }
    return e.repo.enTransaccion(async (repo) => guardarNueva(repo, op.apartar(await contexto(e, repo), solicitud)))
  },

  iniciarPago: async (d, e) => {
    const token = texto(d, 'token')
    const parteIds = textos(d, 'parteIds')
    const nombre = texto(d, 'nombre', true)
    if (!e.pasarela && !conPagoSimulado(e)) throw new ErrorDeDatos('no_permitido', 'Los pagos en línea todavía no están activos. Paga en el local.')
    await frenar(e, 'iniciarPago')
    const config = await e.repo.config()
    const { intento, reserva } = await e.repo.enTransaccion(async (repo) => {
      const ahora = e.ahora()
      const r = (await repo.reservaPor('tokenPrivado', token)) ?? (await repo.reservaPor('tokenCobro', token))
      if (!r) throw noEncontrada()
      const actual = op.vencerApartado(r, ahora) ?? r
      const delOrganizador = token === actual.tokenPrivado
      const volverA = delOrganizador ? `/r/${actual.tokenPrivado}` : `/c/${actual.tokenCobro}`
      // El link privado es de una sola persona: si vuelve a pagar es porque
      // salió de la pasarela sin pagar (regresó, cerró la pestaña, falló la
      // red). Antes su propio intento la bloqueaba hasta que vencía el
      // apartado y perdía la mesa. El link de cobro lo comparten varios
      // amigos: ahí el bloqueo se queda para que no paguen dos la misma parte.
      if (delOrganizador) await repo.liberarIntentos(actual.id, volverA, ahora)
      const enProceso = await repo.partesEnProceso(actual.id, ahora)
      const pago = op.prepararPago(actual, parteIds, delOrganizador ? actual.organizador.nombre : nombre, ahora, enProceso)
      const id = nuevoId()
      // El plazo NO se renueva al reintentar. También los amigos necesitan un
      // checkout que venza; de otro modo su bloqueo se liberaría con el cobro abierto.
      const venceEn = actual.estado === 'apartada'
        ? actual.apartadaHasta!
        : ahora + config.reglas.minutosDeApartado * 60_000
      const intento: IntentoDePago = { id, reservaId: actual.id, parteIds, ...pago, volverA, resultado: null, venceEn }
      await repo.crearIntento(intento)
      return { intento, reserva: actual }
    })
    if (!e.pasarela) return { url: `/pago/${intento.id}` }
    // Fuera de la transacción: mientras Clip contesta, nadie más tiene por
    // qué esperar el candado de las mesas.
    const { url, cobroId } = await e.pasarela.crearCobro({
      intentoId: intento.id,
      titulo: `Reta Saca · ${config.deportes[reserva.deporte]?.nombre ?? 'Reserva'} · ${reserva.folio}`,
      monto: intento.monto,
      volverA: e.sitio + intento.volverA,
      venceEn: intento.venceEn!,
    })
    // Se apunta qué cobro de Clip es de este intento: al regresar, el
    // navegador solo trae el id del intento y con esto se le pregunta a Clip.
    await e.repo.anotarCobro(intento.id, cobroId)
    return { url }
  },

  /**
   * Quien regresa de Clip trae el id de su intento: su cobro se registra en
   * ese momento, sin esperar el aviso de Clip (que puede tardar). Si se pagó y
   * cuánto, se le pregunta a Clip; el navegador no decide nada.
   */
  verificarPagoEnLinea: async (d, e) => {
    if (!e.pasarela) return null
    const intento = await e.repo.intento(texto(d, 'pagoId'))
    if (intento?.cobroId) await registrarPagoEnLinea(intento.cobroId, e)
    return null
  },

  reservaPorTokenPrivado: async (d, e) => {
    const r = await e.repo.reservaPor('tokenPrivado', texto(d, 'token'))
    return r ? (op.vencerApartado(r, e.ahora()) ?? r) : null
  },

  vistaDeCobro: async (d, e) => {
    const r = await e.repo.reservaPor('tokenCobro', texto(d, 'token'))
    // Recortada: sin WhatsApp ni link privado. El link de cobro se reenvía en grupos.
    return r ? op.vistaDeCobro(op.vencerApartado(r, e.ahora()) ?? r, await e.repo.partesEnProceso(r.id, e.ahora())) : null
  },

  cancelarComoCliente: async (d, e) => {
    const token = texto(d, 'token')
    return e.repo.enTransaccion(async (repo) => {
      const ctx = await contexto(e, repo)
      const nueva = op.cancelarComoCliente(ctx, await reservaPor(repo, 'tokenPrivado', token, ctx.ahora))
      await repo.guardar(nueva)
      return nueva
    })
  },

  // ── Pago simulado (solo mientras no hay pasarela) ──

  pagoSimuladoObtener: async (d, e) => {
    if (!conPagoSimulado(e)) return null

    const intento = await e.repo.intento(texto(d, 'id'))
    const reserva = intento && (await e.repo.reservaPor('id', intento.reservaId))

    if (!intento || !reserva) return null

    // Se eligen los campos explícitamente: agregar datos a Reserva no debe
    // publicarlos automáticamente en la pantalla de pago.
    return {
      intento: {
        nombre: intento.nombre,
        monto: intento.monto,
        resultado: intento.resultado,
      },
      reserva: {
        folio: reserva.folio,
        fecha: reserva.fecha,
        inicio: reserva.inicio,
      },
    }
  },

  pagoSimuladoConfirmar: async (d, e) => {
    if (!conPagoSimulado(e)) throw new ErrorDeDatos('no_permitido', 'Los pagos en línea todavía no están activos.')
    const id = texto(d, 'id')
    return e.repo.enTransaccion(async (repo) => {
      const intento = await repo.intento(id)
      if (!intento) throw new ErrorDeDatos('no_encontrada', 'Ese pago no existe.')
      if (intento.resultado) return intento.volverA
      // Con el cupo del día de la reserva, igual que con la pasarela: pudo
      // moverse a más de 30 días y ahí la ventana de siempre no ve a nadie.
      const guardada = await repo.reservaPor('id', intento.reservaId)
      if (!guardada) throw noEncontrada()
      const ctx = await contexto(e, repo, guardada.fecha)
      const r = op.vencerApartado(guardada, ctx.ahora) ?? guardada
      await repo.guardar(op.confirmarPagoEnLinea(ctx, r, intento.parteIds, intento.nombre))
      await repo.cerrarIntento(id, 'pagado')
      return intento.volverA + '?pago=aprobado'
    })
  },

  pagoSimuladoRechazar: async (d, e) => {
    if (!conPagoSimulado(e)) throw new ErrorDeDatos('no_permitido', 'Los pagos en línea todavía no están activos.')
    const intento = await e.repo.intento(texto(d, 'id'))
    if (!intento) throw new ErrorDeDatos('no_encontrada', 'Ese pago no existe.')
    await e.repo.cerrarIntento(intento.id, 'cancelado')
    return intento.volverA + '?pago=cancelado'
  },

  // ── Panel (con sesión) ──

  /** Quién es la cuenta de esta sesión en el panel, o null si no tiene acceso. */
  yo: async (_d, e) => (e.cuentaId ? e.repo.perfil(e.cuentaId) : null),

  reservasEntre: async (d, e) => {
    await usuarioDe(e)
    const ahora = e.ahora()
    const orden = (r: Reserva) => r.fecha + String(r.inicio).padStart(4, '0')
    return (await e.repo.reservasEntre(fecha(d, 'desde'), fecha(d, 'hasta')))
      .map((r) => op.vencerApartado(r, ahora) ?? r)
      .sort((a, b) => orden(a).localeCompare(orden(b)))
  },

  pagosDelDia: async (d, e) => {
    await usuarioDe(e)
    const dia = fecha(d, 'fecha')
    // Se buscan por la fecha del PAGO, no de la reserva. Antes se tomaban las
    // reservas de 7 días antes a 8 después: un cobro de hoy de una reserva que
    // luego se movió a diciembre desaparecía del cierre de caja.
    const desde = new Date(instante(dia, 0)).toISOString()
    const hasta = new Date(instante(sumarDias(dia, 1), 0)).toISOString()
    return op.pagosDelDia(await e.repo.reservasConPagosEntre(desde, hasta), dia)
  },

  cotizarSinReserva: async (d, e) => {
    await usuarioDe(e)
    return op.cotizarSinReserva({ config: await e.repo.config(), reservas: [], ahora: e.ahora() }, deporte(d), duracion(d), modalidad(d), siONo(d, 'palasExtra'))
  },

  anotarSinReserva: async (d, e) => {
    const quien = await usuarioDe(e)
    const c = d.cliente as Datos | undefined
    if (!c || typeof c !== 'object') throw invalido('cliente')
    const cliente: ClienteSinReserva = {
      deporte: deporte(c),
      duracion: duracion(c),
      nombre: texto(c, 'nombre'),
      whatsapp: texto(c, 'whatsapp', true) || undefined,
      mesa: texto(c, 'mesa', true) || undefined,
      medio: medioDelLocal(c),
      precioEsperado: c.precioEsperado === undefined ? undefined : numero(c, 'precioEsperado'),
      modalidad: modalidad(c),
      palasExtra: siONo(c, 'palasExtra'),
    }
    return e.repo.enTransaccion(async (repo) => guardarNueva(repo, op.anotarSinReserva(await contexto(e, repo), cliente, quien.nombre)))
  },

  asignarMesa: enPanel((d, ctx, r) => op.asignarMesa(ctx, r, d.mesa === null ? null : texto(d, 'mesa'))),
  marcarPago: enPanel((d, ctx, r, quien) =>
    op.marcarPago(ctx, r, textos(d, 'parteIds'), medioDelLocal(d), texto(d, 'nombre', true) || undefined, quien.nombre),
  ),
  extender: enPanel((d, ctx, r) => op.extender(ctx, r, duracion(d, 'minutos'))),
    cambiarHorario: enPanel(
    (d, ctx, r) => op.cambiarHorario(
      ctx,
      r,
      fecha(d, 'fecha'),
      numero(d, 'inicio'),
    ),
    (d) => fecha(d, 'fecha'),
  ),
  cancelarComoNegocio: enPanel((_d, ctx, r, quien) => op.cancelarComoNegocio(ctx, r, quien.nombre)),
  devolucionesPorRevisar: async (_d, e) => {
    await usuarioDe(e)
    return e.repo.devolucionesPorRevisar()
  },
  resolverDevolucion: enPanel((d, ctx, r, quien) => {
    const decision = d.decision
    if (decision !== 'transferida' && decision !== 'sin_devolucion') throw invalido('decision')
    return op.resolverDevolucion(ctx, r, decision, quien.nombre)
  }),
  liberarPorRetraso: enPanel((_d, ctx, r, quien) => op.liberarPorRetraso(ctx, r, quien.nombre)),

  guardarConfiguracion: async (d, e) => {
    await dueno(e)
    const config = d.config as Configuracion
    if (!config || typeof config !== 'object') throw invalido('config')
    op.validarConfiguracion(config)
    return e.repo.enTransaccion(async (repo) => {
      // TODAS las reservas que faltan, no la ventana de 30 días: desde el panel
      // se puede mover una a diciembre, y quitar mesas no avisaba de ella.
      const ahora = e.ahora()
      const reservas = (await repo.reservasEntre(momentoDe(ahora).fecha, '9999-12-31')).map((r) => op.vencerApartado(r, ahora) ?? r)
      const conflictos = op.conflictosCon(config, reservas, ahora)
      if (conflictos.length && d.aunqueHayaConflictos !== true) return { guardada: false, conflictos }
      await repo.guardarConfig(config)
      return { guardada: true, conflictos }
    })
  },

  usuarios: async (_d, e) => {
    await usuarioDe(e)
    return e.repo.perfiles()
  },

  agregarUsuario: async (d, e) => {
    await dueno(e)
    const u = d.usuario as Datos | undefined
    if (!u || typeof u !== 'object') throw invalido('usuario')
    const usuario = normalizarUsuario(texto(u, 'usuario'))
    const contrasena = texto(d, 'contrasena')
    const nombre = texto(u, 'nombre').trim()
    const rol = texto(u, 'rol') as Rol
    if (rol !== 'dueno' && rol !== 'recepcion') throw invalido('rol')
    if (nombre.length < 2) throw new ErrorDeDatos('datos_invalidos', 'Escribe el nombre de la persona.')
    if (!usuarioValido(usuario)) {
      throw new ErrorDeDatos('datos_invalidos', 'El usuario va de 3 a 30 letras o números, sin espacios ni acentos.')
    }
    if (contrasena.length < MINIMO_CONTRASENA) {
      throw new ErrorDeDatos('datos_invalidos', `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`)
    }
    if ((await e.repo.perfiles()).some((x) => x.usuario === usuario)) throw new ErrorDeDatos('datos_invalidos', 'Ese usuario ya existe.')
    const id = await e.cuentas.crear(usuario, contrasena)
    const nuevo: Usuario = { id, nombre, usuario, rol }
    try {
      await e.repo.guardarPerfil(nuevo)
    } catch (error) {
      // Cuenta sin perfil: no entra al panel, pero ocupa el usuario y el alta
      // ya no se podía repetir. Se deshace para que el dueño lo intente otra vez.
      await e.cuentas.borrar(id).catch((otro) => console.error('[usuarios] no se pudo deshacer la cuenta', id, otro))
      throw error
    }
    return nuevo
  },

  quitarUsuario: async (d, e) => {
    const yo = await dueno(e)
    const id = texto(d, 'id')
    if (id === yo.id) throw new ErrorDeDatos('no_permitido', 'No te puedes quitar el acceso a ti mismo.')
    // Primero la cuenta: si falla, no cambió nada y se puede reintentar. Al
    // revés, un fallo dejaba la cuenta sin perfil. En la base, borrar la
    // cuenta borra también su perfil (on delete cascade); esto cubre el resto.
    await e.cuentas.borrar(id)
    await e.repo.borrarPerfil(id)
    return null
  },
}
