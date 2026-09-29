// El Repositorio del servidor (src/servidor/repositorio.ts) sobre Postgres.
// Corre dentro de la Edge Function, conectado con SUPABASE_DB_URL (el rol de la
// base, que no pasa por RLS: por eso ninguna de estas consultas sale al
// navegador).

import postgres from 'npm:postgres@3.4.9'
import type { Usuario } from '../../src/datos/contrato'
import { CONFIGURACION_INICIAL, type Configuracion } from '../../src/negocio/configuracion'
import type { Reserva } from '../../src/negocio/reserva'
import { FolioRepetido, type IntentoDePago, type Repositorio } from '../../src/servidor/repositorio'

type Sql = ReturnType<typeof postgres>

/**
 * Número del candado de las escrituras. Todas toman el mismo: se forman en
 * fila y cada una lee, revisa y guarda sin que otra se cuele. Para el tamaño
 * del local (unas cuantas reservas por hora) una fila es de sobra, y así no
 * hay forma de que dos grupos aparten la misma última mesa.
 */
const CANDADO = 4217

const COLUMNA = { id: 'id', tokenPrivado: 'token_privado', tokenCobro: 'token_cobro' } as const

export function repositorioPostgres(sql: Sql): Repositorio {
  // `q` es la conexión normal o la de una transacción: las consultas son las mismas.
  const sobre = (q: Sql): Repositorio => ({
    config: async () => {
      const [fila] = await q`select datos from public.configuracion where id = 1`
      if (fila) return fila.datos as Configuracion
      // Primera vez: se guarda la configuración inicial del código.
      await q`insert into public.configuracion (id, datos) values (1, ${q.json(CONFIGURACION_INICIAL as never)}) on conflict (id) do nothing`
      const [nueva] = await q`select datos from public.configuracion where id = 1`
      return nueva.datos as Configuracion
    },
    guardarConfig: async (c) => {
      await q`
        insert into public.configuracion (id, datos, actualizada_en) values (1, ${q.json(c as never)}, now())
        on conflict (id) do update set datos = excluded.datos, actualizada_en = now()`
    },

    reservasEntre: async (desde, hasta) =>
      (await q`select datos from public.reservas where fecha between ${desde} and ${hasta}`).map((f) => f.datos as Reserva),

    reservaPor: async (campo, valor) => {
      // Se compara como texto: un "id" que no es uuid (lo mandó cualquiera) no
      // debe tronar la consulta, solo no encontrar nada.
      const [fila] = await q`select datos from public.reservas where ${q(COLUMNA[campo])}::text = ${valor}`
      return (fila?.datos as Reserva) ?? null
    },

    guardar: async (r) => {
      // El folio se revisa ANTES de escribir: un error de restricción dentro de
      // una transacción la deja inservible y ya no se podría reintentar.
      const [otra] = await q`select 1 from public.reservas where folio = ${r.folio} and id <> ${r.id}`
      if (otra) throw new FolioRepetido()
      await q`
        insert into public.reservas (id, datos) values (${r.id}, ${q.json(r as never)})
        on conflict (id) do update set datos = excluded.datos, actualizada_en = now()`
    },

    crearIntento: async (i) => {
      await q`
        insert into public.intentos_pago (id, reserva_id, parte_ids, nombre, monto, volver_a, resultado)
        values (${i.id}, ${i.reservaId}, ${i.parteIds}, ${i.nombre}, ${i.monto}, ${i.volverA}, ${i.resultado})`
    },
    intento: async (id) => {
      const [f] = await q`
        select id::text, reserva_id::text, parte_ids, nombre, monto, volver_a, resultado
        from public.intentos_pago where id::text = ${id}`
      if (!f) return null
      const intento: IntentoDePago = {
        id: f.id,
        reservaId: f.reserva_id,
        parteIds: f.parte_ids,
        nombre: f.nombre,
        monto: f.monto,
        volverA: f.volver_a,
        resultado: f.resultado,
      }
      return intento
    },
    cerrarIntento: async (id, resultado) => {
      await q`update public.intentos_pago set resultado = ${resultado} where id::text = ${id} and resultado is null`
    },

    perfil: async (id) => {
      const [f] = await q`select id::text, nombre, correo, rol from public.perfiles where id::text = ${id}`
      return (f as Usuario | undefined) ?? null
    },
    perfiles: async () => (await q`select id::text, nombre, correo, rol from public.perfiles order by nombre`) as unknown as Usuario[],
    guardarPerfil: async (u) => {
      await q`
        insert into public.perfiles (id, nombre, correo, rol) values (${u.id}, ${u.nombre}, ${u.correo}, ${u.rol})
        on conflict (id) do update set nombre = excluded.nombre, correo = excluded.correo, rol = excluded.rol`
    },
    borrarPerfil: async (id) => {
      await q`delete from public.perfiles where id::text = ${id}`
    },

    enTransaccion: (f) =>
      sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${CANDADO})`
        return f(sobre(tx as unknown as Sql))
      }) as ReturnType<typeof f>,
  })

  return sobre(sql)
}
