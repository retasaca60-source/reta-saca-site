-- Cornhole como el volante del negocio (25/10/2026), que corrige lo que se
-- había puesto horas antes por un mensaje (1 h o 90 min):
--
-- - Cornhole se vende por 30 min o 1 h: estándar (4 personas) $160 / $280 y
--   para 2 personas $120 / $180. Sin hora y media ni 2 horas.
-- - Con eso los dos juegos son de 30 min o 1 h, y en línea solo entran esos.
--
-- Ping Pong ($100 / $150), la promo apagada, el horario y lo demás no se
-- tocan. Las reservas ya hechas conservan su precio y su tiempo.

update public.configuracion
set datos = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        datos,
        '{deportes,cornhole,duraciones}', '[30, 60]'
      ),
      '{deportes,cornhole,precios}', '{"30": 160, "60": 280}'
    ),
    '{deportes,cornhole,preciosPareja}', '{"30": 120, "60": 180}'
  ),
  '{reglas,duracionesEnLinea}', '[30, 60]'
);
