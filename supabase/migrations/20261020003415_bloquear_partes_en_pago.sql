-- Los nuevos checkouts bloquean sus partes hasta el mismo vencimiento enviado a Mercado Pago.
-- Los intentos anteriores quedan NULL: no tenían un vencimiento de checkout verificable.
alter table public.intentos_pago add column vence_en timestamptz;

create index intentos_pago_pendientes_por_reserva
  on public.intentos_pago (reserva_id, vence_en)
  where resultado is null;
