-- Esquema de Reta Saca.
--
-- Nadie desde el navegador lee ni escribe estas tablas directamente: todo pasa
-- por la Edge Function `api` (supabase/fuentes/api.ts), que se conecta con el
-- rol de la base y aplica las reglas de src/negocio/operaciones. Por eso RLS
-- está encendido en todas y ni `anon` ni `authenticated` tienen permisos,
-- salvo UNO: el panel puede leer `reservas`, que es lo que necesita Realtime
-- para avisar a la laptop de recepción cuando entra o cambia una reserva.
--
-- Cada reserva se guarda COMPLETA en `datos` (la forma exacta de `Reserva` en
-- src/negocio/reserva.ts) y las columnas por las que se busca o que no se
-- pueden repetir se sacan de ahí (columnas generadas). Así lo guardado y lo
-- que usan las reglas nunca se desalinean, y folio y links son únicos por
-- restricción de la base, no por confianza.

-- ─── Configuración: una sola fila ──────────────────────────────────────────

create table public.configuracion (
  id smallint primary key default 1 check (id = 1),
  datos jsonb not null,
  actualizada_en timestamptz not null default now()
);

-- ─── Reservas ──────────────────────────────────────────────────────────────

create table public.reservas (
  id uuid primary key,
  datos jsonb not null check (datos ->> 'id' = id::text),
  folio text generated always as (datos ->> 'folio') stored not null,
  token_privado text generated always as (datos ->> 'tokenPrivado') stored not null,
  token_cobro text generated always as (datos ->> 'tokenCobro') stored not null,
  fecha text generated always as (datos ->> 'fecha') stored not null,
  deporte text generated always as (datos ->> 'deporte') stored not null,
  estado text generated always as (datos ->> 'estado') stored not null,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  constraint reservas_fecha_valida check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint reservas_deporte_valido check (deporte in ('pingpong', 'cornhole', 'popdarts')),
  constraint reservas_estado_valido check (estado in ('apartada', 'confirmada', 'cancelada'))
);

create unique index reservas_folio_unico on public.reservas (folio);
create unique index reservas_token_privado_unico on public.reservas (token_privado);
create unique index reservas_token_cobro_unico on public.reservas (token_cobro);
-- Casi toda consulta es "las reservas de estos días".
create index reservas_fecha on public.reservas (fecha);

-- ─── Intentos de pago en línea ─────────────────────────────────────────────

create table public.intentos_pago (
  id uuid primary key,
  reserva_id uuid not null references public.reservas (id) on delete cascade,
  parte_ids text[] not null,
  nombre text not null,
  monto integer not null check (monto > 0),
  volver_a text not null,
  resultado text check (resultado in ('pagado', 'cancelado')),
  creado_en timestamptz not null default now()
);

create index intentos_pago_reserva on public.intentos_pago (reserva_id);

-- ─── Perfiles del panel ────────────────────────────────────────────────────
-- Tener cuenta en Supabase Auth no basta para entrar al panel: hace falta una
-- fila aquí. El rol vive aquí y no en los metadatos del usuario, que el propio
-- usuario puede editar.

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  correo text not null unique,
  rol text not null check (rol in ('dueno', 'recepcion')),
  creado_en timestamptz not null default now()
);

-- ─── Permisos ──────────────────────────────────────────────────────────────

alter table public.configuracion enable row level security;
alter table public.reservas enable row level security;
alter table public.intentos_pago enable row level security;
alter table public.perfiles enable row level security;

-- Supabase da permisos a `anon` y `authenticated` sobre las tablas nuevas de
-- `public`: se quitan todos. Lo único que pasa es lo que se concede abajo.
revoke all on public.configuracion, public.reservas, public.intentos_pago, public.perfiles from anon, authenticated;

-- ¿La sesión de esta petición es de alguien del panel? Vive en un esquema que
-- no se publica en la API. Es SECURITY DEFINER porque la política de abajo la
-- evalúa con los permisos del usuario, que no puede leer `perfiles`; y solo
-- responde por el propio usuario (auth.uid()), nunca por otro.
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

create function privado.es_del_panel()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()))
$$;

-- En Supabase, quitarle la función a PUBLIC no se la quita a `anon`: se
-- nombran los dos.
revoke execute on function privado.es_del_panel() from public, anon;
grant execute on function privado.es_del_panel() to authenticated;

-- El panel lee reservas (solo leer): para Realtime.
grant select on public.reservas to authenticated;

create policy "el panel lee las reservas"
  on public.reservas
  for select
  to authenticated
  using ((select privado.es_del_panel()));

-- Realtime avisa de los cambios en reservas a quien pueda leerlas (el panel).
alter publication supabase_realtime add table public.reservas;
