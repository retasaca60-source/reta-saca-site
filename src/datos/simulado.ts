// Versión SIMULADA del contrato: todo "funciona como real", pero los datos
// viven en el navegador (localStorage) y el pago es una pantalla de mentira.
//
// Sirve para dos cosas: que el sitio y el panel se puedan usar y diseñar ya, y
// que quien haga la versión real (Supabase + Mercado Pago) tenga un modelo que
// se comporta como debe. Si la real se comporta distinto que esta en algún
// caso, una de las dos está mal: revisar contra RESERVAS.md.
//
// Limitaciones que la versión real NO debe copiar:
// - Los datos son de este navegador: el celular del cliente y la laptop de
//   recepción NO ven lo mismo. (Dos pestañas del mismo navegador sí.)
// - La hora sale del reloj del aparato; la real usa la del servidor.
// - Cualquiera entra al panel con los correos de demostración: la contraseña no
//   se revisa.

import {
  CONFIGURACION_INICIAL,
  mesasEnServicio,
  ORDEN_DEPORTES,
  type Configuracion,
  type DeporteId,
  type Duracion,
} from '../negocio/configuracion'
import { mesasLibres, ocupadasEn } from '../negocio/disponibilidad'
import { cabeEnUnBloque, estaCerrado, iniciosPosibles } from '../negocio/horario'
import { precioDe, precioDeExtension } from '../negocio/precios'
import {
  estaActiva,
  puedeCancelarConDevolucion,
  puedeLiberarPorRetraso,
  repartir,
  type Reserva,
} from '../negocio/reserva'
import { instante, momentoDe, sumarDias, type Momento } from '../negocio/tiempo'
import {
  ErrorDeDatos,
  type ClienteSinReserva,
  type Conflicto,
  type PagoDelDia,
  type ServicioDeDatos,
  type SolicitudDeReserva,
  type Usuario,
  type VistaDeCobro,
} from './contrato'

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
 * (lección de CiTerritorio: un campo nuevo que lo viejo no traía tumbó la
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

// ─── Identificadores ─────────────────────────────────────────────────────

// Sin 0/O ni 1/I/L: se dictan por teléfono y ahí se confunden.
const LETRAS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const azar = (n: number, letras = LETRAS) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => letras[b % letras.length]).join('')
const LETRAS_TOKEN = 'abcdefghijkmnpqrstuvwxyz23456789'

// ─── Datos de ejemplo ────────────────────────────────────────────────────

const USUARIOS_DEMO: Usuario[] = [
  { id: 'u-hugo', nombre: 'Hugo', correo: 'hugo@demo.retasaca', rol: 'dueno' },
  { id: 'u-recepcion', nombre: 'Recepción', correo: 'recepcion@demo.retasaca', rol: 'recepcion' },
]

/**
 * Reservas de ejemplo alrededor de hoy, para que el sitio y el panel se vean
 * con vida: pagos completos, a medias, un cliente sin reserva y un horario de
 * Cornhole lleno mañana a las 7 PM.
 */
function sembrar(config: Configuracion, ahora: Momento): Reserva[] {
  const hoy = ahora.fecha
  const manana = sumarDias(hoy, 1)
  const pasado = sumarDias(hoy, 2)
  const reservas: Reserva[] = []
  const nombres = ['Carlos M.', 'Ana R.', 'Luis G.', 'Sofía P.', 'Diego T.', 'Mariana L.', 'Jorge V.', 'Paola S.', 'Iván C.', 'Fer N.']
  let n = 0
  const nueva = (
    deporte: DeporteId,
    fecha: string,
    inicio: number,
    duracion: Duracion,
    partes: 1 | 2 | 4,
    pagadas: number,
    extra: Partial<Reserva> = {},
  ) => {
    const { precio, conPromo } = precioDe(config, deporte, inicio, duracion)
    const nombre = nombres[n % nombres.length]
    n++
    const r: Reserva = {
      id: crypto.randomUUID(),
      folio: 'RS-' + azar(5),
      tokenPrivado: azar(14, LETRAS_TOKEN),
      tokenCobro: azar(14, LETRAS_TOKEN),
      deporte,
      fecha,
      inicio,
      duracion,
      precio,
      conPromo,
      partesElegidas: partes,
      partes: repartir(precio, partes).map((monto, i) => ({
        id: crypto.randomUUID(),
        monto,
        delOrganizador: i === 0,
        concepto: 'reserva',
        pago: i < pagadas ? { medio: 'en_linea', nombre: i === 0 ? nombre : `Amigo ${i}`, en: new Date(ahora.ms - 86400_000).toISOString() } : null,
      })),
      organizador: { nombre, whatsapp: '66200000' + String(n).padStart(2, '0') },
      origen: 'sitio',
      estado: 'confirmada',
      apartadaHasta: null,
      mesa: null,
      llegaronEn: null,
      cancelacion: null,
      creadaEn: new Date(ahora.ms - 86400_000).toISOString(),
      ...extra,
    }
    reservas.push(r)
  }
  const h = (x: number, m = 0) => x * 60 + m
  // Hoy
  nueva('pingpong', hoy, h(17), 60, 2, 2)
  nueva('pingpong', hoy, h(18), 90, 4, 1)
  nueva('cornhole', hoy, h(19), 60, 4, 3)
  nueva('popdarts', hoy, h(20), 60, 1, 1)
  nueva('cornhole', hoy, h(20), 120, 1, 1)
  // Mañana: Cornhole lleno a las 7 PM
  for (let i = 0; i < mesasEnServicio(config.deportes.cornhole); i++) nueva('cornhole', manana, h(19), 60, 2, 1)
  nueva('pingpong', manana, h(17, 30), 60, 4, 2)
  nueva('popdarts', manana, h(18), 90, 1, 1)
  // Pasado mañana
  nueva('pingpong', pasado, h(20), 60, 1, 1)
  return reservas
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

  const ahora = () => momentoDe(reloj())
  const esperar = () => (demora ? new Promise((r) => setTimeout(r, demora)) : Promise.resolve())

  function nuevoEstado(): Estado {
    const config = structuredClone(CONFIGURACION_INICIAL)
    return { version: 1, config, reservas: conEjemplos ? sembrar(config, ahora()) : [], intentos: [], usuarios: [...USUARIOS_DEMO], sesion: null }
  }

  function leer(): Estado {
    const texto = almacen.leer()
    if (texto) {
      try {
        const e = JSON.parse(texto)
        if (esEstadoValido(e)) return vencerApartados(e)
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

  /** Un apartado cuyo plazo pasó sin pagar deja de ocupar mesa y se marca cancelado. */
  function vencerApartados(e: Estado): Estado {
    const ms = reloj()
    for (const r of e.reservas) {
      if (r.estado === 'apartada' && r.apartadaHasta !== null && r.apartadaHasta <= ms) {
        r.estado = 'cancelada'
        r.cancelacion = { motivo: 'apartado_vencido', en: new Date(r.apartadaHasta).toISOString() }
      }
    }
    return e
  }

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

  const buscar = (e: Estado, id: string) => {
    const r = e.reservas.find((x) => x.id === id)
    if (!r) throw new ErrorDeDatos('no_encontrada', 'No se encontró la reserva.')
    return r
  }

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

  const folioNuevo = (e: Estado) => {
    let f: string
    do f = 'RS-' + azar(5)
    while (e.reservas.some((r) => r.folio === f))
    return f
  }

  const devolverPagosEnLinea = (r: Reserva) => {
    for (const p of r.partes) if (p.pago?.medio === 'en_linea') p.pago.devuelto = true
  }

  const servicio: ServicioSimulado = {
    modo: 'simulado',

    configuracion: () => consultar((e) => e.config),

    disponibilidad: (deporte, fecha, duracion) =>
      consultar((e) => {
        const m = ahora()
        return iniciosPosibles(e.config, fecha, duracion, m).map((inicio) => ({
          inicio,
          libres: Math.max(0, mesasLibres(e.config, e.reservas, deporte, fecha, inicio, duracion, m.ms)),
          ...precioDe(e.config, deporte, inicio, duracion),
        }))
      }),

    apartar: (s: SolicitudDeReserva) =>
      cambiar((e) => {
        const m = ahora()
        const d = e.config.deportes[s.deporte]
        const nombre = s.organizador.nombre.trim()
        const whatsapp = s.organizador.whatsapp.replace(/\D/g, '')
        if (!d || !d.duraciones.includes(s.duracion)) throw new ErrorDeDatos('datos_invalidos', 'Esa duración no existe para ese deporte.')
        if (nombre.length < 2 || whatsapp.length !== 10) throw new ErrorDeDatos('datos_invalidos', 'Falta tu nombre o tu WhatsApp de 10 dígitos.')
        const partes = d.seDivide ? s.partes : 1
        if (![1, 2, 4].includes(partes)) throw new ErrorDeDatos('datos_invalidos', 'Solo se divide entre 2 o entre 4.')
        if (!iniciosPosibles(e.config, s.fecha, s.duracion, m).includes(s.inicio)) {
          throw new ErrorDeDatos('fuera_de_horario', 'Ese horario ya no se puede reservar. Elige otro.')
        }
        const activas = e.reservas.filter((r) => r.organizador.whatsapp === whatsapp && estaActiva(r, m.ms)).length
        if (activas >= e.config.reglas.reservasActivasPorWhatsapp) {
          throw new ErrorDeDatos(
            'limite_whatsapp',
            `Ese WhatsApp ya tiene ${activas} reservas activas (el máximo es ${e.config.reglas.reservasActivasPorWhatsapp}). Para grupos más grandes, escríbenos.`,
          )
        }
        if (mesasLibres(e.config, e.reservas, s.deporte, s.fecha, s.inicio, s.duracion, m.ms) < 1) {
          throw new ErrorDeDatos('sin_lugar', 'Alguien acaba de tomar la última mesa de ese horario. Elige otro.')
        }
        const { precio, conPromo } = precioDe(e.config, s.deporte, s.inicio, s.duracion)
        const r: Reserva = {
          id: crypto.randomUUID(),
          folio: folioNuevo(e),
          tokenPrivado: azar(14, LETRAS_TOKEN),
          tokenCobro: azar(14, LETRAS_TOKEN),
          deporte: s.deporte,
          fecha: s.fecha,
          inicio: s.inicio,
          duracion: s.duracion,
          precio,
          conPromo,
          partesElegidas: partes,
          partes: repartir(precio, partes).map((monto, i) => ({ id: crypto.randomUUID(), monto, delOrganizador: i === 0, concepto: 'reserva', pago: null })),
          organizador: { nombre, whatsapp },
          origen: 'sitio',
          estado: 'apartada',
          apartadaHasta: m.ms + e.config.reglas.minutosDeApartado * 60_000,
          mesa: null,
          llegaronEn: null,
          cancelacion: null,
          creadaEn: new Date(m.ms).toISOString(),
        }
        e.reservas.push(r)
        return r
      }),

    iniciarPago: (token, parteIds, nombre) =>
      cambiar((e) => {
        const m = ahora()
        const r = e.reservas.find((x) => x.tokenPrivado === token || x.tokenCobro === token)
        if (!r) throw new ErrorDeDatos('no_encontrada', 'No se encontró la reserva.')
        if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'Esta reserva está cancelada.')
        const partes = r.partes.filter((p) => parteIds.includes(p.id))
        if (!partes.length || partes.length !== parteIds.length || partes.some((p) => p.pago)) {
          throw new ErrorDeDatos('datos_invalidos', 'Esa parte ya está pagada. Recarga la página.')
        }
        const quien = token === r.tokenPrivado ? r.organizador.nombre : nombre.trim()
        if (quien.length < 2) throw new ErrorDeDatos('datos_invalidos', 'Escribe tu nombre para que recepción sepa quién pagó.')
        const id = crypto.randomUUID()
        const volverA = token === r.tokenPrivado ? `/r/${r.tokenPrivado}` : `/c/${r.tokenCobro}`
        e.intentos.push({ id, reservaId: r.id, parteIds, nombre: quien, monto: partes.reduce((s, p) => s + p.monto, 0), volverA, resultado: null })
        // Si el apartado se venció mientras tanto pero la mesa sigue libre, se renueva.
        if (r.estado === 'apartada') r.apartadaHasta = Math.max(r.apartadaHasta ?? 0, m.ms + e.config.reglas.minutosDeApartado * 60_000)
        return { url: `/pago/${id}` }
      }),

    reservaPorTokenPrivado: (token) => consultar((e) => e.reservas.find((r) => r.tokenPrivado === token) ?? null),

    vistaDeCobro: (token) =>
      consultar((e): VistaDeCobro | null => {
        const r = e.reservas.find((x) => x.tokenCobro === token)
        if (!r) return null
        return {
          folio: r.folio,
          deporte: r.deporte,
          fecha: r.fecha,
          inicio: r.inicio,
          duracion: r.duracion,
          precio: r.precio,
          organizador: r.organizador.nombre,
          estado: r.estado,
          partes: r.partes.map((p) => ({
            id: p.id,
            monto: p.monto,
            pagada: Boolean(p.pago && !p.pago.devuelto),
            nombre: p.pago?.nombre ?? null,
            delOrganizador: p.delOrganizador,
          })),
        }
      }),

    cancelarComoCliente: (token) =>
      cambiar((e) => {
        const r = e.reservas.find((x) => x.tokenPrivado === token)
        if (!r) throw new ErrorDeDatos('no_encontrada', 'No se encontró la reserva.')
        if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'Esta reserva ya estaba cancelada.')
        const m = ahora()
        if (instante(r.fecha, r.inicio) <= m.ms) throw new ErrorDeDatos('no_permitido', 'La reserva ya empezó. Habla con recepción.')
        // Se puede cancelar siempre antes de empezar (libera la mesa para otro),
        // pero solo se devuelve el dinero hasta N horas antes.
        if (puedeCancelarConDevolucion(r, e.config, m.ms)) devolverPagosEnLinea(r)
        r.estado = 'cancelada'
        r.cancelacion = { motivo: 'cliente', en: new Date(m.ms).toISOString() }
        return r
      }),

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
        return e.reservas
          .filter((r) => r.fecha >= desde && r.fecha <= hasta)
          .sort((a, b) => (a.fecha + String(a.inicio).padStart(4, '0')).localeCompare(b.fecha + String(b.inicio).padStart(4, '0')))
      }),

    pagosDelDia: (fecha) =>
      consultar((e) => {
        usuarioActual(e)
        const pagos: PagoDelDia[] = []
        for (const r of e.reservas) {
          for (const p of r.partes) {
            if (!p.pago || momentoDe(Date.parse(p.pago.en)).fecha !== fecha) continue
            pagos.push({
              reservaId: r.id,
              folio: r.folio,
              deporte: r.deporte,
              parteId: p.id,
              monto: p.monto,
              medio: p.pago.medio,
              nombre: p.pago.nombre,
              en: p.pago.en,
              marcadoPor: p.pago.marcadoPor,
              devuelto: Boolean(p.pago.devuelto),
            })
          }
        }
        return pagos.sort((a, b) => a.en.localeCompare(b.en))
      }),

    anotarSinReserva: (c: ClienteSinReserva) =>
      cambiar((e) => {
        usuarioActual(e)
        const m = ahora()
        const d = e.config.deportes[c.deporte]
        if (!d.duraciones.includes(c.duracion)) throw new ErrorDeDatos('datos_invalidos', 'Esa duración no existe para ese deporte.')
        if (c.nombre.trim().length < 2) throw new ErrorDeDatos('datos_invalidos', 'Escribe un nombre para identificar al grupo.')
        if (estaCerrado(e.config, m.fecha) || !cabeEnUnBloque(e.config, m.fecha, m.minutos, c.duracion)) {
          throw new ErrorDeDatos('fuera_de_horario', 'No alcanza a terminar antes del cierre.')
        }
        if (mesasLibres(e.config, e.reservas, c.deporte, m.fecha, m.minutos, c.duracion, m.ms) < 1) {
          throw new ErrorDeDatos('sin_lugar', `No hay ${d.nombre} libre durante todo ese tiempo.`)
        }
        // Para el precio cuenta la media hora en que empiezan: un grupo que llega
        // a las 5:10 entra en la promo de las 5:00.
        const paso = e.config.reglas.pasoDeInicio
        const { precio, conPromo } = precioDe(e.config, c.deporte, Math.floor(m.minutos / paso) * paso, c.duracion)
        const r: Reserva = {
          id: crypto.randomUUID(),
          folio: folioNuevo(e),
          tokenPrivado: azar(14, LETRAS_TOKEN),
          tokenCobro: azar(14, LETRAS_TOKEN),
          deporte: c.deporte,
          fecha: m.fecha,
          inicio: m.minutos,
          duracion: c.duracion,
          precio,
          conPromo,
          partesElegidas: 1,
          partes: [{ id: crypto.randomUUID(), monto: precio, delOrganizador: true, concepto: 'reserva', pago: null }],
          organizador: { nombre: c.nombre.trim(), whatsapp: (c.whatsapp ?? '').replace(/\D/g, '') },
          origen: 'mostrador',
          estado: 'confirmada',
          apartadaHasta: null,
          mesa: null,
          llegaronEn: new Date(m.ms).toISOString(),
          cancelacion: null,
          creadaEn: new Date(m.ms).toISOString(),
        }
        e.reservas.push(r)
        if (c.mesa) asignar(e, r, c.mesa)
        return r
      }),

    asignarMesa: (id, mesa) =>
      cambiar((e) => {
        usuarioActual(e)
        const r = buscar(e, id)
        if (mesa === null) {
          r.mesa = null
          return r
        }
        asignar(e, r, mesa)
        return r
      }),

    marcarPago: (id, parteIds, medio, nombre) =>
      cambiar((e) => {
        const u = usuarioActual(e)
        const r = buscar(e, id)
        if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'La reserva está cancelada.')
        const partes = r.partes.filter((p) => parteIds.includes(p.id) && !p.pago)
        if (!partes.length) throw new ErrorDeDatos('datos_invalidos', 'Esas partes ya estaban pagadas.')
        const en = new Date(reloj()).toISOString()
        for (const p of partes) p.pago = { medio, nombre: nombre?.trim() || r.organizador.nombre, en, marcadoPor: u.nombre }
        if (r.estado === 'apartada') {
          r.estado = 'confirmada'
          r.apartadaHasta = null
        }
        return r
      }),

    extender: (id, minutos) =>
      cambiar((e) => {
        usuarioActual(e)
        const r = buscar(e, id)
        if (r.estado !== 'confirmada') throw new ErrorDeDatos('no_permitido', 'Solo se extienden reservas confirmadas.')
        const nueva = r.duracion + minutos
        if (!cabeEnUnBloque(e.config, r.fecha, r.inicio, nueva)) throw new ErrorDeDatos('fuera_de_horario', 'No alcanza antes del cierre.')
        if (mesasLibres(e.config, e.reservas, r.deporte, r.fecha, r.inicio, nueva, reloj(), r.id) < 1) {
          throw new ErrorDeDatos('sin_lugar', 'La mesa no está libre ese tiempo extra.')
        }
        r.partes.push({
          id: crypto.randomUUID(),
          monto: precioDeExtension(e.config, r.deporte, r.duracion, minutos),
          delOrganizador: true,
          concepto: 'extension',
          pago: null,
        })
        r.duracion = nueva
        return r
      }),

    cambiarHorario: (id, fecha, inicio) =>
      cambiar((e) => {
        usuarioActual(e)
        const r = buscar(e, id)
        if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'La reserva está cancelada.')
        if (estaCerrado(e.config, fecha) || !cabeEnUnBloque(e.config, fecha, inicio, r.duracion)) {
          throw new ErrorDeDatos('fuera_de_horario', 'Ese horario está fuera del horario del local.')
        }
        if (mesasLibres(e.config, e.reservas, r.deporte, fecha, inicio, r.duracion, reloj(), r.id) < 1) {
          throw new ErrorDeDatos('sin_lugar', 'No hay mesa libre en ese horario.')
        }
        // Si el horario nuevo cuesta más (se pierde la promo), la diferencia se
        // cobra en el local. Si cuesta menos, se queda como estaba.
        // PENDIENTE DE CONFIRMAR CON HUGO (RESERVAS.md → Pendientes).
        const d = e.config.deportes[r.deporte]
        if (d.precios[r.duracion as Duracion] !== undefined) {
          const nuevo = precioDe(e.config, r.deporte, inicio, r.duracion as Duracion).precio
          if (nuevo > r.precio) {
            r.partes.push({ id: crypto.randomUUID(), monto: nuevo - r.precio, delOrganizador: true, concepto: 'cambio', pago: null })
          }
        }
        r.fecha = fecha
        r.inicio = inicio
        r.mesa = null
        r.llegaronEn = null
        return r
      }),

    cancelarComoNegocio: (id) =>
      cambiar((e) => {
        const u = usuarioActual(e)
        const r = buscar(e, id)
        if (r.estado === 'cancelada') throw new ErrorDeDatos('no_permitido', 'Ya estaba cancelada.')
        devolverPagosEnLinea(r)
        r.estado = 'cancelada'
        r.cancelacion = { motivo: 'negocio', en: new Date(reloj()).toISOString(), por: u.nombre }
        return r
      }),

    liberarPorRetraso: (id) =>
      cambiar((e) => {
        const u = usuarioActual(e)
        const r = buscar(e, id)
        if (!puedeLiberarPorRetraso(r, e.config, reloj())) {
          throw new ErrorDeDatos('no_permitido', `Todavía no pasan los ${e.config.reglas.minutosDeTolerancia} minutos de tolerancia, o ya llegaron.`)
        }
        r.estado = 'cancelada'
        r.cancelacion = { motivo: 'no_llego', en: new Date(reloj()).toISOString(), por: u.nombre }
        return r
      }),

    guardarConfiguracion: (config, aunqueHayaConflictos = false) =>
      cambiar((e) => {
        soloDueno(e)
        validarConfiguracion(config)
        const conflictos = conflictosCon(config, e.reservas, reloj())
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
        const nuevo = { ...u, id: crypto.randomUUID() }
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

    // ── Solo simulado ──

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
          const r = buscar(e, intento.reservaId)
          if (intento.resultado) return intento.volverA
          const ms = reloj()
          if (r.estado === 'cancelada') {
            // Se venció el apartado mientras pagaba: solo se rescata si la mesa sigue libre.
            const libre = r.cancelacion?.motivo === 'apartado_vencido' && mesasLibres(e.config, e.reservas, r.deporte, r.fecha, r.inicio, r.duracion, ms, r.id) >= 1
            if (!libre) throw new ErrorDeDatos('apartado_vencido', 'Se venció el tiempo para pagar y la mesa ya no está disponible. No se hizo ningún cobro.')
            r.cancelacion = null
          }
          const en = new Date(ms).toISOString()
          for (const p of r.partes) if (intento.parteIds.includes(p.id) && !p.pago) p.pago = { medio: 'en_linea', nombre: intento.nombre, en }
          r.estado = 'confirmada'
          r.apartadaHasta = null
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

  /** Asigna una mesa concreta revisando que exista, funcione y no la tenga otro grupo a esa hora. */
  function asignar(e: Estado, r: Reserva, mesa: string) {
    const d = e.config.deportes[r.deporte]
    const n = Number(mesa.replace(d.clave, '').trim())
    if (!Number.isInteger(n) || n < 1 || n > d.mesas) throw new ErrorDeDatos('datos_invalidos', `${mesa} no existe.`)
    if (d.fueraDeServicio.includes(n)) throw new ErrorDeDatos('no_permitido', `${mesa} está fuera de servicio.`)
    const etiqueta = `${d.clave} ${n}`
    const otra = e.reservas.find(
      (x) =>
        x.id !== r.id &&
        x.estado === 'confirmada' &&
        x.mesa === etiqueta &&
        x.fecha === r.fecha &&
        x.inicio < r.inicio + r.duracion &&
        x.inicio + x.duracion > r.inicio,
    )
    if (otra) throw new ErrorDeDatos('no_permitido', `${etiqueta} ya la tiene ${otra.organizador.nombre} a esa hora.`)
    r.mesa = etiqueta
    r.llegaronEn ??= new Date(reloj()).toISOString()
  }

  return servicio
}

// ─── Configuración: validar y revisar conflictos ─────────────────────────

function validarConfiguracion(c: Configuracion) {
  for (const id of ORDEN_DEPORTES) {
    const d = c.deportes[id]
    if (!Number.isInteger(d.mesas) || d.mesas < 0 || d.mesas > 50) throw new ErrorDeDatos('datos_invalidos', `Número de mesas de ${d.nombre} inválido.`)
    for (const dur of d.duraciones) {
      const p = d.precios[dur]
      if (p === undefined || !Number.isInteger(p) || p <= 0) throw new ErrorDeDatos('datos_invalidos', `Falta el precio de ${d.nombre} de ${dur} min.`)
    }
    if (d.precioPromo !== null && (!Number.isInteger(d.precioPromo) || d.precioPromo <= 0)) {
      throw new ErrorDeDatos('datos_invalidos', `Precio de promo de ${d.nombre} inválido.`)
    }
  }
  for (const bloques of Object.values(c.horario)) {
    for (const b of bloques) if (!(b.desde < b.hasta)) throw new ErrorDeDatos('datos_invalidos', 'Un horario cierra antes de abrir.')
  }
}

/**
 * Con la configuración nueva, ¿qué reservas futuras se quedarían sin mesa o
 * fuera de horario? Nunca se cancela nada sola: se le avisa a Hugo.
 */
export function conflictosCon(config: Configuracion, reservas: readonly Reserva[], ahoraMs: number): Conflicto[] {
  const hoy = momentoDe(ahoraMs).fecha
  const vistos = new Set<string>()
  const conflictos: Conflicto[] = []
  for (const r of reservas) {
    if (r.estado !== 'confirmada' || r.fecha < hoy) continue
    const llave = `${r.deporte}|${r.fecha}|${r.inicio}`
    if (vistos.has(llave)) continue
    const mesas = estaCerrado(config, r.fecha) || !cabeEnUnBloque(config, r.fecha, r.inicio, r.duracion) ? 0 : mesasEnServicio(config.deportes[r.deporte])
    const ocupadas = ocupadasEn(reservas, r.deporte, r.fecha, r.inicio, r.duracion, ahoraMs)
    if (ocupadas > mesas) {
      vistos.add(llave)
      conflictos.push({ deporte: r.deporte, fecha: r.fecha, inicio: r.inicio, reservas: ocupadas, mesas })
    }
  }
  return conflictos
}
