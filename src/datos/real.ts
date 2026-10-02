// Versión REAL del contrato: los datos viven en Supabase y las reglas corren en
// el servidor (servidor/api.ts, dentro de una Edge Function).
//
// Este archivo es delgado a propósito: cada operación es "mándala al servidor".
// No decide precios, lugares ni horas: el navegador no es de fiar (el sitio y
// el repositorio son públicos). Cómo llega la petición al servidor lo pone la
// `Conexion`: en el navegador, Supabase (datos/conexionSupabase.ts); en las
// pruebas, el servidor mismo con una base en memoria. Así las pruebas del
// contrato corren contra el mismo servidor que corre en Supabase.

import type { Configuracion } from '../negocio/configuracion'
import type { Reserva } from '../negocio/reserva'
import {
  ErrorDeDatos,
  type Conflicto,
  type HorarioDisponible,
  type VistaDePagoSimulado,
  type PagoDelDia,
  type PagoSimulado,
  type ServicioDeDatos,
  type Usuario,
  type VistaDeCobro,
} from './contrato'

export interface Conexion {
  /** Manda una acción al servidor. Devuelve el resultado o lanza ErrorDeDatos con el mensaje para la persona. */
  llamar(accion: string, datos?: Record<string, unknown>): Promise<unknown>
  /** Inicia sesión (Supabase Auth). Si el usuario o la contraseña no cuadran, lanza ErrorDeDatos('sin_sesion'). */
  entrar(usuario: string, contrasena: string): Promise<void>
  salir(): Promise<void>
  /** Avisa cuando cambian los datos o la sesión. Devuelve cómo dejar de escuchar. */
  escuchar(aviso: () => void): () => void
}

export type ServicioReal = ServicioDeDatos & { pagoSimulado: PagoSimulado }

export function crearServicioReal(conexion: Conexion): ServicioReal {
  const llamar = <T>(accion: string, datos?: Record<string, unknown>) => conexion.llamar(accion, datos) as Promise<T>

  // Avisar a las pantallas de ESTE navegador cuando una acción suya cambió
  // algo. Realtime solo avisa con sesión del panel: sin esto, el cliente que
  // cancelaba seguía viendo su reserva "confirmada" hasta recargar.
  // verificarPagoEnLinea no avisa: lo llama la carga misma de la página y
  // avisar ahí la volvería a cargar sin fin.
  const locales = new Set<() => void>()
  const cambia = async <T>(p: Promise<T>): Promise<T> => {
    const r = await p
    locales.forEach((f) => f())
    return r
  }

  return {
    modo: 'real',

    configuracion: () => llamar<Configuracion>('configuracion'),
    disponibilidad: (deporte, fecha, duracion) => llamar<HorarioDisponible[]>('disponibilidad', { deporte, fecha, duracion }),
    apartar: (solicitud) => llamar<Reserva>('apartar', { solicitud: { ...solicitud } }),
    iniciarPago: (token, parteIds, nombre) => llamar<{ url: string }>('iniciarPago', { token, parteIds, nombre }),
    reservaPorTokenPrivado: (token) => llamar<Reserva | null>('reservaPorTokenPrivado', { token }),
    vistaDeCobro: (token) => llamar<VistaDeCobro | null>('vistaDeCobro', { token }),
    verificarPagoEnLinea: async (pagoId) => {
      await llamar<null>('verificarPagoEnLinea', { pagoId })
    },
    cancelarComoCliente: (token) => cambia(llamar<Reserva>('cancelarComoCliente', { token })),

    sesion: () => llamar<Usuario | null>('yo'),
    iniciarSesion: async (usuario, contrasena) => {
      await conexion.entrar(usuario, contrasena)
      // Tener cuenta en Supabase no basta: hace falta un perfil del panel.
      const yo = await llamar<Usuario | null>('yo')
      if (!yo) {
        await conexion.salir()
        throw new ErrorDeDatos('sin_sesion', 'Ese usuario no tiene acceso al panel.')
      }
      return yo
    },
    cerrarSesion: () => conexion.salir(),

    reservasEntre: (desde, hasta) => llamar<Reserva[]>('reservasEntre', { desde, hasta }),
    pagosDelDia: (fecha) => llamar<PagoDelDia[]>('pagosDelDia', { fecha }),
    anotarSinReserva: (cliente) => cambia(llamar<Reserva>('anotarSinReserva', { cliente: { ...cliente } })),
    asignarMesa: (reservaId, mesa) => cambia(llamar<Reserva>('asignarMesa', { reservaId, mesa })),
    marcarPago: (reservaId, parteIds, medio, nombre) => cambia(llamar<Reserva>('marcarPago', { reservaId, parteIds, medio, nombre })),
    extender: (reservaId, minutos) => cambia(llamar<Reserva>('extender', { reservaId, minutos })),
    cambiarHorario: (reservaId, fecha, inicio) => cambia(llamar<Reserva>('cambiarHorario', { reservaId, fecha, inicio })),
    cancelarComoNegocio: (reservaId) => cambia(llamar<Reserva>('cancelarComoNegocio', { reservaId })),
    devolucionesPorRevisar: () => llamar<Reserva[]>('devolucionesPorRevisar', {}),
    resolverDevolucion: (reservaId, decision) => cambia(llamar<Reserva>('resolverDevolucion', { reservaId, decision })),
    liberarPorRetraso: (reservaId) => cambia(llamar<Reserva>('liberarPorRetraso', { reservaId })),
    guardarConfiguracion: (config, aunqueHayaConflictos = false) =>
      cambia(llamar<{ guardada: boolean; conflictos: Conflicto[] }>('guardarConfiguracion', { config, aunqueHayaConflictos })),
    usuarios: () => llamar<Usuario[]>('usuarios'),
    agregarUsuario: (usuario, contrasena) => cambia(llamar<Usuario>('agregarUsuario', { usuario: { ...usuario }, contrasena })),
    quitarUsuario: async (id) => void (await cambia(llamar('quitarUsuario', { id }))),

    alCambiar: (aviso) => {
      locales.add(aviso)
      const dejar = conexion.escuchar(aviso)
      return () => {
        locales.delete(aviso)
        dejar()
      }
    },

    pagoSimulado: {
      obtener: (id) => llamar<VistaDePagoSimulado | null>('pagoSimuladoObtener', { id }),
      confirmar: (id) => llamar<string>('pagoSimuladoConfirmar', { id }),
      rechazar: (id) => llamar<string>('pagoSimuladoRechazar', { id }),
    },
  }
}
