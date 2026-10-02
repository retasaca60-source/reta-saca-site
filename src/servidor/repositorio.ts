// Lo que el servidor necesita de la base de datos, sin decir cuál.
//
// En producción lo cumple Postgres (supabase/functions/api/postgres.ts); en las
// pruebas, la versión en memoria de abajo. Así las reglas del servidor
// (servidor/api.ts) se prueban aquí, sin base de datos, y en Supabase corren
// exactamente igual.

import type { IntentoDePago, Usuario } from '../datos/contrato'
import type { Configuracion } from '../negocio/configuracion'
import type { Reserva } from '../negocio/reserva'

export type { IntentoDePago }

/** Dos reservas no pueden tener el mismo folio: la base lo impide y avisa con esto. */
export class FolioRepetido extends Error {
  constructor() {
    super('Folio repetido')
    this.name = 'FolioRepetido'
  }
}

export interface Repositorio {
  /** La configuración vigente. Si todavía no hay, guarda y devuelve la inicial. */
  config(): Promise<Configuracion>
  guardarConfig(c: Configuracion): Promise<void>

  /** Reservas con fecha entre dos días "AAAA-MM-DD" (incluidos), de todos los estados. */
  reservasEntre(desde: string, hasta: string): Promise<Reserva[]>
  reservaPor(campo: 'id' | 'tokenPrivado' | 'tokenCobro', valor: string): Promise<Reserva | null>
  /**
   * Reservas (de cualquier fecha) con algún pago hecho entre dos instantes ISO:
   * `desde` incluido, `hasta` no. Para la caja: un pago de hoy puede ser de una
   * reserva que se movió a diciembre.
   */
  reservasConPagosEntre(desde: string, hasta: string): Promise<Reserva[]>
  /** Canceladas con devolución por revisar, de cualquier fecha; las más recientes primero. */
  devolucionesPorRevisar(): Promise<Reserva[]>
  /** Crea o reemplaza la reserva completa. Si el folio ya lo tiene otra, lanza FolioRepetido. */
  guardar(r: Reserva): Promise<void>

  /**
   * Suma uno al contador de `llave` en la ventana que empieza en `ventana` (ms)
   * y devuelve cuántos lleva. Sumar y leer pasan juntos: dos llamadas al mismo
   * tiempo no pueden leer el mismo número.
   */
  contarIntento(llave: string, ventana: number): Promise<number>

  crearIntento(i: IntentoDePago): Promise<void>
  intento(id: string): Promise<IntentoDePago | null>
  cerrarIntento(id: string, resultado: 'pagado' | 'cancelado'): Promise<void>

  perfil(id: string): Promise<Usuario | null>
  perfiles(): Promise<Usuario[]>
  guardarPerfil(u: Usuario): Promise<void>
  borrarPerfil(id: string): Promise<void>

  /**
   * Corre `f` dentro de UNA transacción y de una en una: mientras corre, ninguna
   * otra escritura puede colarse. Es lo que impide que dos personas aparten la
   * última mesa al mismo tiempo (leer, revisar y guardar pasan juntos).
   */
  enTransaccion<T>(f: (repo: Repositorio) => Promise<T>): Promise<T>
}

// ─── En memoria, para las pruebas ────────────────────────────────────────

export function repositorioEnMemoria(inicial: Configuracion): Repositorio {
  let config = structuredClone(inicial)
  const reservas = new Map<string, Reserva>()
  const intentos = new Map<string, IntentoDePago>()
  const perfiles = new Map<string, Usuario>()
  const contadores = new Map<string, number>()
  // Una cadena de promesas hace de candado: cada transacción espera a la anterior.
  let cola: Promise<unknown> = Promise.resolve()

  const clon = <T>(x: T): T => structuredClone(x)

  const repo: Repositorio = {
    config: async () => clon(config),
    guardarConfig: async (c) => void (config = clon(c)),

    reservasEntre: async (desde, hasta) => [...reservas.values()].filter((r) => r.fecha >= desde && r.fecha <= hasta).map(clon),
    reservaPor: async (campo, valor) => clon([...reservas.values()].find((r) => r[campo] === valor) ?? null),
    reservasConPagosEntre: async (desde, hasta) =>
      [...reservas.values()].filter((r) => r.partes.some((p) => p.pago && p.pago.en >= desde && p.pago.en < hasta)).map(clon),
    devolucionesPorRevisar: async () =>
      [...reservas.values()]
        .filter((r) => r.devolucion?.estado === 'por_revisar')
        .sort((a, b) => (b.cancelacion?.en ?? '').localeCompare(a.cancelacion?.en ?? ''))
        .map(clon),
    guardar: async (r) => {
      if ([...reservas.values()].some((x) => x.folio === r.folio && x.id !== r.id)) throw new FolioRepetido()
      reservas.set(r.id, clon(r))
    },

    contarIntento: async (llave, ventana) => {
      const k = `${llave}|${ventana}`
      const n = (contadores.get(k) ?? 0) + 1
      contadores.set(k, n)
      return n
    },
    crearIntento: async (i) => void intentos.set(i.id, clon(i)),
    intento: async (id) => clon(intentos.get(id) ?? null),
    cerrarIntento: async (id, resultado) => {
      const i = intentos.get(id)
      if (i && !i.resultado) i.resultado = resultado
    },

    perfil: async (id) => clon(perfiles.get(id) ?? null),
    perfiles: async () => [...perfiles.values()].map(clon),
    guardarPerfil: async (u) => void perfiles.set(u.id, clon(u)),
    borrarPerfil: async (id) => void perfiles.delete(id),

    // Como Postgres: si algo falla a la mitad, no queda nada de lo que se
    // escribió. Antes lo guardado antes del error se quedaba, y una prueba
    // podía pasar aquí y fallar en la base de verdad.
    enTransaccion: (f) => {
      const turno = cola.then(async () => {
        const antes = {
          config: clon(config),
          reservas: clon([...reservas]),
          intentos: clon([...intentos]),
          perfiles: clon([...perfiles]),
          contadores: [...contadores],
        }
        try {
          return await f(repo)
        } catch (e) {
          config = antes.config
          for (const [mapa, filas] of [
            [reservas, antes.reservas],
            [intentos, antes.intentos],
            [perfiles, antes.perfiles],
            [contadores, antes.contadores],
          ] as [Map<string, unknown>, [string, unknown][]][]) {
            mapa.clear()
            for (const [k, v] of filas) mapa.set(k, v)
          }
          throw e
        }
      })
      cola = turno.catch(() => undefined)
      return turno
    },
  }
  return repo
}
