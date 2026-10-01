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
import type { Configuracion, DeporteId, Duracion } from '../negocio/configuracion'
import { ErrorDeDatos, type CodigoDeError } from '../negocio/errores'
import { formatoDinero } from '../negocio/formato'
import { nuevoFolio, nuevoId } from '../negocio/identificadores'
import * as op from '../negocio/operaciones'
import type { ClienteSinReserva, SolicitudDeReserva } from '../negocio/operaciones'
import type { MedioDePago, Reserva } from '../negocio/reserva'
import { momentoDe, sumarDias } from '../negocio/tiempo'
import { FolioRepetido, type Repositorio } from './repositorio'

/** Alta y baja de cuentas del panel (Supabase Auth). */
export interface Cuentas {
  /** Crea la cuenta ya confirmada, con esa contraseña, y devuelve su id. */
  crear(usuario: string, contrasena: string): Promise<string>
  borrar(id: string): Promise<void>
}

/** Lo que se le pide a Mercado Pago. La versión de verdad está en supabase/fuentes/mercadopago.ts. */
export interface MercadoPago {
  /** Crea el cobro (una "preferencia" de Checkout Pro) y devuelve a dónde mandar a quien paga. */
  crearCobro(c: CobroNuevo): Promise<string>
  /** Pregunta por un pago directamente a Mercado Pago. null si no existe. */
  consultarPago(id: string): Promise<PagoDeMercadoPago | null>
}

export interface CobroNuevo {
  /** El id del intento: Mercado Pago lo devuelve como referencia en cada pago. */
  intentoId: string
  titulo: string
  monto: number
  /** URL completa a la que regresa al terminar, sin parámetros. */
  volverA: string
  /** Hasta cuándo se puede pagar (ms): el fin del apartado. null si la mesa ya es suya. */
  venceEn: number | null
}

export interface PagoDeMercadoPago {
  id: string
  /** "approved", "rejected", "in_process"… */
  estado: string
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
   * Mientras no haya Mercado Pago, el pago en línea es la pantalla simulada
   * (/pago/<id>). Con Mercado Pago conectado se ignora: si no, cualquiera
   * podría confirmar desde la pantalla simulada un cobro que nunca pagó.
   */
  pagosSimulados: boolean
  /** Mercado Pago, si hay llave (MP_ACCESS_TOKEN). */
  mercadoPago: MercadoPago | null
  /** De dónde viene quien paga ("https://…"), para que Mercado Pago lo regrese ahí. */
  sitio: string
  /** La dirección (IP) de quien llama, para el límite de frecuencia. null si no se sabe. */
  cliente: string | null
}

/** La pantalla simulada solo existe mientras no haya Mercado Pago de verdad. */
const conPagoSimulado = (e: Entorno) => e.pagosSimulados && !e.mercadoPago

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
    return { resultado: await accion(p.datos ?? {}, entorno) }
  } catch (e) {
    if (e instanceof ErrorDeDatos) return { error: { codigo: e.codigo, mensaje: e.message } }
    console.error('[api]', p.accion, e)
    return { error: { codigo: 'datos_invalidos', mensaje: 'Algo falló de nuestro lado. Intenta otra vez en un momento.' } }
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw invalido(campo)
  return v
}
function deporte(d: Datos, campo = 'deporte'): DeporteId {
  const v = texto(d, campo)
  if (v !== 'pingpong' && v !== 'cornhole' && v !== 'popdarts') throw invalido(campo)
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
 * Las reservas que pueden chocar con cualquier operación: de ayer hasta el
 * final de la ventana de reserva (o 30 días, lo que sea más). Un apartado
 * vencido se entrega ya como cancelado, igual que en la versión simulada.
 */
async function contexto(entorno: Entorno, repo = entorno.repo): Promise<op.Contexto> {
  const config = await repo.config()
  const ahora = entorno.ahora()
  const hoy = momentoDe(ahora).fecha
  const hasta = sumarDias(hoy, Math.max(config.reglas.diasDeAnticipacion, 30))
  const reservas = (await repo.reservasEntre(sumarDias(hoy, -1), hasta)).map((r) => op.vencerApartado(r, ahora) ?? r)
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

/** Una operación del panel sobre una reserva existente: exige sesión, y lee, aplica y guarda en una transacción. */
function enPanel(f: (d: Datos, ctx: op.Contexto, r: Reserva, quien: Usuario) => Reserva) {
  return async (d: Datos, entorno: Entorno) => {
    const quien = await usuarioDe(entorno)
    const id = texto(d, 'reservaId')
    return entorno.repo.enTransaccion(async (repo) => {
      const ctx = await contexto(entorno, repo)
      const r = await reservaPor(repo, 'id', id, ctx.ahora)
      const nueva = f(d, ctx, r, quien)
      await repo.guardar(nueva)
      return nueva
    })
  }
}

/**
 * Registra un pago de Mercado Pago: lo usan el aviso de Mercado Pago y el
 * regreso de quien pagó, y da igual cuál llegue primero o si llegan los dos.
 *
 * Nada de lo que manda quien llama se cree: con el id se le pregunta a
 * Mercado Pago, y solo cuenta un pago aprobado, en pesos, por el monto exacto
 * del intento. Lanza si Mercado Pago no contesta, para que el aviso se
 * reintente; lo demás (un id que no es nuestro, un pago rechazado) se ignora.
 */
export async function registrarPagoEnLinea(pagoId: string, e: Entorno): Promise<void> {
  if (!e.mercadoPago || !/^\d{1,30}$/.test(pagoId)) return
  const pago = await e.mercadoPago.consultarPago(pagoId)
  if (!pago || pago.estado !== 'approved' || !pago.referencia) return
  const referencia = pago.referencia
  await e.repo.enTransaccion(async (repo) => {
    const intento = await repo.intento(referencia)
    if (!intento || intento.resultado === 'pagado') return
    if (pago.monto !== intento.monto || pago.moneda !== 'MXN') {
      console.error('[mercadopago] el pago no coincide con su intento', pago.id, intento.id)
      return
    }
    const ctx = await contexto(e, repo)
    const r = await reservaPor(repo, 'id', intento.reservaId, ctx.ahora)
    try {
      await repo.guardar(op.confirmarPagoEnLinea(ctx, r, intento.parteIds, intento.nombre))
    } catch (error) {
      if (!(error instanceof ErrorDeDatos)) throw error
      // Mercado Pago ya cobró, pero la mesa se fue o alguien pagó esas partes
      // antes: el dinero entró y queda por devolver, como una cancelación.
      // La nota no copia el mensaje del error: ese le habla a quien paga ("no
      // se hizo ningún cobro") y aquí el cobro sí se hizo.
      const motivo =
        error.codigo === 'apartado_vencido'
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
 * Mercado Pago. Holgado a propósito: en México muchos celulares salen a
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

  disponibilidad: async (d, e) => op.horariosDisponibles(await contexto(e), deporte(d), fecha(d, 'fecha'), duracion(d)),

  apartar: async (d, e) => {
    await frenar(e, 'apartar')
    const s = d.solicitud as Datos | undefined
    if (!s || typeof s !== 'object') throw invalido('solicitud')
    const org = s.organizador as Datos | undefined
    if (!org || typeof org !== 'object') throw invalido('organizador')
    const partes = numero(s, 'partes')
    if (partes !== 1 && partes !== 2 && partes !== 4) throw invalido('partes')
    const solicitud: SolicitudDeReserva = {
      deporte: deporte(s),
      fecha: fecha(s, 'fecha'),
      inicio: numero(s, 'inicio'),
      duracion: duracion(s),
      partes,
      organizador: { nombre: texto(org, 'nombre'), whatsapp: texto(org, 'whatsapp') },
    }
    return e.repo.enTransaccion(async (repo) => guardarNueva(repo, op.apartar(await contexto(e, repo), solicitud)))
  },

  iniciarPago: async (d, e) => {
    const token = texto(d, 'token')
    const parteIds = textos(d, 'parteIds')
    const nombre = texto(d, 'nombre', true)
    if (!e.mercadoPago && !conPagoSimulado(e)) throw new ErrorDeDatos('no_permitido', 'Los pagos en línea todavía no están activos. Paga en el local.')
    await frenar(e, 'iniciarPago')
    const config = await e.repo.config()
    const { intento, reserva } = await e.repo.enTransaccion(async (repo) => {
      const ahora = e.ahora()
      const r = (await repo.reservaPor('tokenPrivado', token)) ?? (await repo.reservaPor('tokenCobro', token))
      if (!r) throw noEncontrada()
      const actual = op.vencerApartado(r, ahora) ?? r
      const delOrganizador = token === actual.tokenPrivado
      const pago = op.prepararPago(actual, parteIds, delOrganizador ? actual.organizador.nombre : nombre)
      const id = nuevoId()
      const volverA = delOrganizador ? `/r/${actual.tokenPrivado}` : `/c/${actual.tokenCobro}`
      const intento: IntentoDePago = { id, reservaId: actual.id, parteIds, ...pago, volverA, resultado: null }
      await repo.crearIntento(intento)
      return { intento, reserva: actual }
    })
    if (!e.mercadoPago) return { url: `/pago/${intento.id}` }
    // Fuera de la transacción: mientras Mercado Pago contesta, nadie más
    // tiene por qué esperar el candado de las mesas.
    const url = await e.mercadoPago.crearCobro({
      intentoId: intento.id,
      titulo: `Reta Saca · ${config.deportes[reserva.deporte].nombre} · ${reserva.folio}`,
      monto: intento.monto,
      volverA: e.sitio + intento.volverA,
      venceEn: reserva.estado === 'apartada' ? reserva.apartadaHasta : null,
    })
    return { url }
  },

  /**
   * Quien regresa de Mercado Pago trae el id de su pago: se registra en ese
   * momento, sin esperar el aviso de Mercado Pago (que puede tardar). Lo que
   * manda el navegador es solo el id; si se pagó y cuánto, se le pregunta a
   * Mercado Pago.
   */
  verificarPagoEnLinea: async (d, e) => {
    if (!e.mercadoPago) return null
    await registrarPagoEnLinea(texto(d, 'pagoId'), e)
    return null
  },

  reservaPorTokenPrivado: async (d, e) => {
    const r = await e.repo.reservaPor('tokenPrivado', texto(d, 'token'))
    return r ? (op.vencerApartado(r, e.ahora()) ?? r) : null
  },

  vistaDeCobro: async (d, e) => {
    const r = await e.repo.reservaPor('tokenCobro', texto(d, 'token'))
    // Recortada: sin WhatsApp ni link privado. El link de cobro se reenvía en grupos.
    return r ? op.vistaDeCobro(op.vencerApartado(r, e.ahora()) ?? r) : null
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

  // ── Pago simulado (solo mientras no hay Mercado Pago) ──

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
      const ctx = await contexto(e, repo)
      const r = await reservaPor(repo, 'id', intento.reservaId, ctx.ahora)
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
    // Un pago de hoy puede ser de una reserva de hasta 7 días adelante (pagó
    // al reservar) o de días pasados (pagó lo que faltaba después).
    return op.pagosDelDia(await e.repo.reservasEntre(sumarDias(dia, -7), sumarDias(dia, 8)), dia)
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
    }
    return e.repo.enTransaccion(async (repo) => guardarNueva(repo, op.anotarSinReserva(await contexto(e, repo), cliente, quien.nombre)))
  },

  asignarMesa: enPanel((d, ctx, r) => op.asignarMesa(ctx, r, d.mesa === null ? null : texto(d, 'mesa'))),
  marcarPago: enPanel((d, ctx, r, quien) =>
    op.marcarPago(ctx, r, textos(d, 'parteIds'), medioDelLocal(d), texto(d, 'nombre', true) || undefined, quien.nombre),
  ),
  extender: enPanel((d, ctx, r) => op.extender(ctx, r, duracion(d, 'minutos'))),
  cambiarHorario: enPanel((d, ctx, r) => op.cambiarHorario(ctx, r, fecha(d, 'fecha'), numero(d, 'inicio'))),
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
      const ctx = await contexto(e, repo)
      const conflictos = op.conflictosCon(config, ctx.reservas, ctx.ahora)
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
    await e.repo.guardarPerfil(nuevo)
    return nuevo
  },

  quitarUsuario: async (d, e) => {
    const yo = await dueno(e)
    const id = texto(d, 'id')
    if (id === yo.id) throw new ErrorDeDatos('no_permitido', 'No te puedes quitar el acceso a ti mismo.')
    await e.repo.borrarPerfil(id)
    await e.cuentas.borrar(id)
    return null
  },
}
