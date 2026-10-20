-- Cada pago de Mercado Pago que ya se registró, por su id. Sin esto, si
-- alguien pagaba dos veces el mismo cobro (pagó, regresó y volvió a pagar),
-- el segundo pago se ignoraba: el dinero entraba y no quedaba en ningún lado.
-- Con esto, el mismo pago que avisa dos veces se registra una sola vez y un
-- segundo pago del mismo cobro queda por devolver.
--
-- Solo la toca la función (rol de la base); el navegador no tiene permiso.

create table public.pagos_en_linea (
  pago_id text primary key,
  intento_id uuid not null references public.intentos_pago (id) on delete cascade,
  registrado_en timestamptz not null default now()
);

create index pagos_en_linea_intento on public.pagos_en_linea (intento_id);

alter table public.pagos_en_linea enable row level security;
revoke all on public.pagos_en_linea from anon, authenticated;