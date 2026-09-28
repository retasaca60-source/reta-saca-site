// Versión SIMULADA del contrato: todo "funciona como real", pero los datos
// viven en el navegador (localStorage) y el pago es una pantalla de mentira.
//
// Es un ADAPTADOR delgado: lee, llama a las operaciones del negocio
// (negocio/operaciones) y guarda. Las reglas NO viven aquí; la versión real
// (Supabase) llama a esas mismas operaciones desde el servidor.
//
// Limitaciones que la versión real NO debe copiar:
// - Los datos son de este navegador: el celular del cliente y la laptop de
//   recepción NO ven lo mismo. (Dos pestañas del mismo navegador sí.)
// - La hora sale del reloj del aparato; la real usa la del servidor.
// - Cualquiera entra al panel con los correos de demostración: la contraseña no
//   se revisa.

import { CONFIGURACION_INICIAL, ORDEN_DEPORTES, type Configuracion } from '../negocio/configuracion'
import { nuevoFolio, nuevoId } from '../negocio/identificadores'
import * as op from '../negocio/operaciones'
import type { Reserva } from '../negocio/reserva'
import { momentoDe } from '../negocio/tiempo'
import { ErrorDeDatos, type ServicioDeDatos, type Usuario } from './contrato'
import { sembrar, USUARIOS_DEMO } from './ejemplos'

// ─── Almacén ─────────────────────────────────────────────────────────────

/** Dónde se guarda el texto. En el navegador, localStorage; en las pruebas, memoria. */
export interface Almacen {
  leer(): string | null
  escribir(texto: string): void
  /** Avisa si otra pestaña cambió los datos. */
  escuchar?(aviso: () => void): () => void
}

const LLAVE = 'reta-saca:simulado'

export function almacenDelNavegador(): Almacen {
  return {
    leer: () => {
      try {
        return localStorage.getItem(LLAVE)
      } catch {
        return null
      }
    },
    escribir: (t) => {
      try {
        localStorage.setItem(LLAVE, t)
      } catch {
        // Modo privado o almacenamiento lleno: la demostración sigue en memoria.
      }
    },
    escuchar: (aviso) => {
      const f = (e: StorageEvent) => e.key === LLAVE && aviso()
      window.addEventListener('storage', f)
      return () => window.removeEventListener('storage', f)
    },
  }
}

export function almacenEnMemoria(): Almacen {
  let texto: string | null = null
  return { leer: () => texto, escribir: (t) => void (texto = t) }
}

// ─── Estado guardado ─────────────────────────────────────────────────────

export interface IntentoDePago {
  id: string
  reservaId: string
  parteIds: string[]
  nombre: string
  monto: number
  /** A dónde regresa al pagar o cancelar. */
  volverA: string
  resultado: 'pagado' | 'cancelado' | null
}

interface Estado {
  version: 1
  config: Configuracion
  reservas: Reserva[]
  intentos: IntentoDePago[]
  usuarios: Usuario[]
  sesion: string | null
}

/**
 * Lo guardado en el navegador lo pudo escribir OTRA versión de la aplicación
 * (un campo nuevo que la versión anterior no guardaba puede tumbar la
 * pantalla entera). Se revisa campo por campo; si no cuadra, se empieza de cero.
 */
function esEstadoValido(x: unknown): x is Estado {
  const e = x as Estado
  if (!e || e.version !== 1 || !e.config || !Array.isArray(e.reservas) || !Array.isArray(e.intentos) || !Array.isArray(e.usuarios)) return false
  const c = e.config
  if (!c.deportes || !c.horario || !Array.isArray(c.diasCerrados) || !c.promo || !c.reglas || typeof c.whatsappNegocio !== 'string') return false
  for (const id of ORDEN_DEPORTES) {
    const d = c.deportes[id]
    if (!d || typeof d.mesas !== 'number' || !Array.isArray(d.fueraDeServicio) || !Array.isArray(d.duraciones) || typeof d.precios !== 'object') return false
  }
  return e.reservas.every(
    (r) =>
      r &&
      typeof r.id === 'string' &&
      ORDEN_DEPORTES.includes(r.deporte) &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) &&
      typeof r.inicio === 'number' &&
      typeof r.duracion === 'number' &&
      Array.isArray(r.partes) &&
      r.partes.every((p) => typeof p.id === 'string' && typeof p.monto === 'number') &&
      r.organizador &&
      typeof r.organizador.nombre === 'string',
  )
}

// ─── El servicio ─────────────────────────────────────────────────────────

export interface OpcionesSimulado {
  almacen?: Almacen
  /** Reloj en ms; las pruebas lo fijan. */
  reloj?: () => number
  /** Demora artificial para que se vean los estados de "cargando". */
  demoraMs?: number
  /** Si se crean reservas de ejemplo al empezar de cero. */
  conEjemplos?: boolean
}

export type ServicioSimulado = ServicioDeDatos & {
  pagoSimulado: {
    obtener(id: string): Promise<{ intento: IntentoDePago; reserva: Reserva } | null>
    confirmar(id: string): Promise<string>
    rechazar(id: string): Promise<string>
  }
  /** Borra todo y vuelve a los datos de ejemplo. */
  restablecer(): Promise<void>
}

export function crearServicioSimulado(opciones: OpcionesSimulado = {}): ServicioSimulado {
  const almacen = opciones.almacen ?? almacenDelNavegador()
  const reloj = opciones.reloj ?? Date.now
  const demora = opciones.demoraMs ?? 0
  const conEjemplos = opciones.conEjemplos ?? true
  const oyentes = new Set<() => void>()
  const esperar = () => (demora ? new Promise((r) => setTimeout(r, demora)) : Promise.resolve())

  function nuevoEstado(): Estado {
    const config = structuredClone(CONFIGURACION_INICIAL)
    const reservas = conEjemplos ? sembrar(config, momentoDe(reloj())) : []
    return { version: 1, config, reservas, intentos: [], usuarios: [...USUARIOS_DEMO], sesion: null }
  }

  function leer(): Estado {
    const texto = almacen.leer()
    if (texto) {
      try {
        const e = JSON.parse(texto)
        if (esEstadoValido(e)) {
          // Un apartado vencido deja de ocupar mesa en cuanto se lee.
          const ahora = reloj()
          e.reservas = e.reservas.map((r) => op.vencerApartado(r, ahora) ?? r)
          return e
        }
        console.warn('[simulado] Los datos guardados no tienen la forma esperada (¿otra versión?). Se empieza de cero.')
      } catch {
        console.warn('[simulado] Los datos guardados no se pudieron leer. Se empieza de cero.')
      }
    }
    const e = nuevoEstado()
    guardar(e)
    return e
  }

  function guardar(e: Estado) {
    almacen.escribir(JSON.stringify(e))
    oyentes.forEach((f) => f())
  }

  const contexto = (e: Estado): op.Contexto => ({ config: e.config, reservas: e.reservas, ahora: reloj() })

  /** Lee, cambia y guarda en un solo paso. */
  async function cambiar<T>(f: (e: Estado) => T): Promise<T> {
    await esperar()
    const e = leer()
    const resultado = f(e)
    guardar(e)
    return structuredClone(resultado)
  }

  async function consultar<T>(f: (e: Estado) => T): Promise<T> {
    await esperar()
    return structuredClone(f(leer()))
  }

  /** Guarda una reserva nueva o reemplaza la que tenga el mismo id. */
  function poner(e: Estado, r: Reserva): Reserva {
    const i = e.reservas.findIndex((x) => x.id === r.id)
    if (i >= 0) {
      e.reservas[i] = r
      return r
    }
    // Que el folio no se repita: aquí se revisa; en la versión real, una restricción única.
    while (e.reservas.some((x) => x.folio === r.folio)) r.folio = nuevoFolio()
    e.reservas.push(r)
    return r
  }

  const existe = (encontrada: Reserva | undefined) => {
    if (!encontrada) throw new ErrorDeDatos('no_encontrada', 'No se encontró la reserva.')
    return encontrada
  }
  const porId = (e: Estado, id: string) => existe(e.reservas.find((x) => x.id === id))

  const usuarioActual = (e: Estado) => {
    const u = e.usuarios.find((x) => x.id === e.sesion)
    if (!u) throw new ErrorDeDatos('sin_sesion', 'Tu sesión terminó. Vuelve a entrar.')
    return u
  }

  const soloDueno = (e: Estado) => {
    const u = usuarioActual(e)
    if (u.rol !== 'dueno') throw new ErrorDeDatos('no_permitido', 'Solo el dueño puede hacer esto.')
    return u
  }

  /** Una operación del panel sobre una reserva existente: exige sesión y guarda el resultado. */
  const enPanel = (id: string, f: (ctx: op.Contexto, r: Reserva, quien: Usuario) => Reserva) =>
    cambiar((e) => {
      const quien = usuarioActual(e)
      return poner(e, f(contexto(e), porId(e, id), quien))
    })

  const servicio: ServicioSimulado = {
    modo: 'simulado',

    configuracion: () => consultar((e) => e.config),
    disponibilidad: (deporte, fecha, duracion) => consultar((e) => op.horariosDisponibles(contexto(e), deporte, fecha, duracion)),
    apartar: (s) => cambiar((e) => poner(e, op.apartar(contexto(e), s))),

    iniciarPago: (token, parteIds, nombre) =>
      cambiar((e) => {
        const r = existe(e.reservas.find((x) => x.tokenPrivado === token || x.tokenCobro === token))
        const delOrganizador = token === r.tokenPrivado
        const pago = op.prepararPago(r, parteIds, delOrganizador ? r.organizador.nombre : nombre)
        const id = nuevoId()
        const volverA = delOrganizador ? `/r/${r.tokenPrivado}` : `/c/${r.tokenCobro}`
        e.intentos.push({ id, reservaId: r.id, parteIds, ...pago, volverA, resultado: null })
        return { url: `/pago/${id}` }
      }),

    reservaPorTokenPrivado: (token) => consultar((e) => e.reservas.find((r) => r.tokenPrivado === token) ?? null),
    vistaDeCobro: (token) =>
      consultar((e) => {
        const r = e.reservas.find((x) => x.tokenCobro === token)
        return r ? op.vistaDeCobro(r) : null
      }),
    cancelarComoCliente: (token) =>
      cambiar((e) => poner(e, op.cancelarComoCliente(contexto(e), existe(e.reservas.find((x) => x.tokenPrivado === token))))),

    // ── Panel ──

    sesion: () => consultar((e) => e.usuarios.find((u) => u.id === e.sesion) ?? null),
    iniciarSesion: (correo) =>
      cambiar((e) => {
        const u = e.usuarios.find((x) => x.correo.toLowerCase() === correo.trim().toLowerCase())
        if (!u) throw new ErrorDeDatos('sin_sesion', 'Ese correo no tiene acceso al panel.')
        e.sesion = u.id
        return u
      }),
    cerrarSesion: () =>
      cambiar((e) => {
        e.sesion = null
      }),

    reservasEntre: (desde, hasta) =>
      consultar((e) => {
        usuarioActual(e)
        const orden = (r: Reserva) => r.fecha + String(r.inicio).padStart(4, '0')
        return e.reservas.filter((r) => r.fecha >= desde && r.fecha <= hasta).sort((a, b) => orden(a).localeCompare(orden(b)))
      }),
    pagosDelDia: (fecha) =>
      consultar((e) => {
        usuarioActual(e)
        return op.pagosDelDia(e.reservas, fecha)
      }),

    anotarSinReserva: (c) =>
      cambiar((e) => {
        usuarioActual(e)
        return poner(e, op.anotarSinReserva(contexto(e), c))
      }),
    asignarMesa: (id, mesa) => enPanel(id, (ctx, r) => op.asignarMesa(ctx, r, mesa)),
    marcarPago: (id, parteIds, medio, nombre) => enPanel(id, (ctx, r, quien) => op.marcarPago(ctx, r, parteIds, medio, nombre, quien.nombre)),
    extender: (id, minutos) => enPanel(id, (ctx, r) => op.extender(ctx, r, minutos)),
    cambiarHorario: (id, fecha, inicio) => enPanel(id, (ctx, r) => op.cambiarHorario(ctx, r, fecha, inicio)),
    cancelarComoNegocio: (id) => enPanel(id, (ctx, r, quien) => op.cancelarComoNegocio(ctx, r, quien.nombre)),
    liberarPorRetraso: (id) => enPanel(id, (ctx, r, quien) => op.liberarPorRetraso(ctx, r, quien.nombre)),

    guardarConfiguracion: (config, aunqueHayaConflictos = false) =>
      cambiar((e) => {
        soloDueno(e)
        op.validarConfiguracion(config)
        const conflictos = op.conflictosCon(config, e.reservas, reloj())
        if (conflictos.length && !aunqueHayaConflictos) return { guardada: false, conflictos }
        e.config = structuredClone(config)
        return { guardada: true, conflictos }
      }),

    usuarios: () =>
      consultar((e) => {
        usuarioActual(e)
        return e.usuarios
      }),
    agregarUsuario: (u) =>
      cambiar((e) => {
        soloDueno(e)
        if (!/^\S+@\S+\.\S+$/.test(u.correo)) throw new ErrorDeDatos('datos_invalidos', 'Ese correo no parece válido.')
        if (e.usuarios.some((x) => x.correo.toLowerCase() === u.correo.toLowerCase())) {
          throw new ErrorDeDatos('datos_invalidos', 'Ese correo ya tiene acceso.')
        }
        const nuevo = { ...u, id: nuevoId() }
        e.usuarios.push(nuevo)
        return nuevo
      }),
    quitarUsuario: (id) =>
      cambiar((e) => {
        const yo = soloDueno(e)
        if (id === yo.id) throw new ErrorDeDatos('no_permitido', 'No te puedes quitar el acceso a ti mismo.')
        e.usuarios = e.usuarios.filter((u) => u.id !== id)
      }),

    alCambiar: (aviso) => {
      oyentes.add(aviso)
      const dejar = almacen.escuchar?.(aviso)
      return () => {
        oyentes.delete(aviso)
        dejar?.()
      }
    },

    // ── Solo simulado: el lugar de Mercado Pago ──

    pagoSimulado: {
      obtener: (id) =>
        consultar((e) => {
          const intento = e.intentos.find((i) => i.id === id)
          const reserva = intento && e.reservas.find((r) => r.id === intento.reservaId)
          return intento && reserva ? { intento, reserva } : null
        }),
      confirmar: (id) =>
        cambiar((e) => {
          const intento = e.intentos.find((i) => i.id === id)
          if (!intento) throw new ErrorDeDatos('no_encontrada', 'Ese pago no existe.')
          if (intento.resultado) return intento.volverA
          poner(e, op.confirmarPagoEnLinea(contexto(e), porId(e, intento.reservaId), intento.parteIds, intento.nombre))
          intento.resultado = 'pagado'
          return intento.volverA + '?pago=aprobado'
        }),
      rechazar: (id) =>
        cambiar((e) => {
          const intento = e.intentos.find((i) => i.id === id)
          if (!intento) throw new ErrorDeDatos('no_encontrada', 'Ese pago no existe.')
          intento.resultado ??= 'cancelado'
          return intento.volverA + '?pago=cancelado'
        }),
    },

    restablecer: async () => {
      guardar(nuevoEstado())
    },
  }

  return servicio
}
