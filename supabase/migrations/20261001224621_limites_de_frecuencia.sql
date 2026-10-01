-- Cuántas veces ha hecho algo una misma dirección (IP) en una ventana de
-- tiempo. Sin esto, un script podía llamar a "apartar" en bucle y dejar todas
-- las mesas apartadas sin pagar, cada 10 minutos, sin que nadie más pudiera
-- reservar (CN-003 del reporte de seguridad del 01/10/2026).
--
-- Vive en la base y no en la memoria de la función: Supabase corre varias
-- copias de la función a la vez, y un contador en memoria se reparte entre
-- ellas y nunca llega al límite.
--
-- Solo la toca la función (rol de la base); el navegador no tiene permiso.

create table public.limites_de_frecuencia (
  llave text not null,          -- "apartar:<ip>"
  ventana timestamptz not null, -- inicio de la ventana de 10 minutos
  cuenta integer not null default 0,
  primary key (llave, ventana)
);

alter table public.limites_de_frecuencia enable row level security;
revoke all on public.limites_de_frecuencia from anon, authenticated;
