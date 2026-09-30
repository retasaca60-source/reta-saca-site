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
  /** Canceladas con devolución por revisar, de cualquier fecha; las más recientes primero. */
  devolucionesPorRevisar(): Promise<Reserva[]>
  /** Crea o reemplaza la reserva completa. Si el folio ya lo tiene otra, lanza FolioRepetido. */
  guardar(r: Reserva): Promise<void>

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
  // Una cadena de promesas hace de candado: cada transacción espera a la anterior.
  let cola: Promise<unknown> = Promise.resolve()

  const clon = <T>(x: T): T => structuredClone(x)

  const repo: Repositorio = {
    config: async () => clon(config),
    guardarConfig: async (c) => void (config = clon(c)),

    reservasEntre: async (desde, hasta) => [...reservas.values()].filter((r) => r.fecha >= desde && r.fecha <= hasta).map(clon),
    reservaPor: async (campo, valor) => clon([...reservas.values()].find((r) => r[campo] === valor) ?? null),
    devolucionesPorRevisar: async () =>
      [...reservas.values()]
        .filter((r) => r.devolucion?.estado === 'por_revisar')
        .sort((a, b) => (b.cancelacion?.en ?? '').localeCompare(a.cancelacion?.en ?? ''))
        .map(clon),
    guardar: async (r) => {
      if ([...reservas.values()].some((x) => x.folio === r.folio && x.id !== r.id)) throw new FolioRepetido()
      reservas.set(r.id, clon(r))
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

    enTransaccion: (f) => {
      const turno = cola.then(() => f(repo))
      cola = turno.catch(() => undefined)
      return turno
    },
  }
  return repo
}
