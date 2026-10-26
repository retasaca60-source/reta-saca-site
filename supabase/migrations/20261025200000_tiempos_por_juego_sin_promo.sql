-- Lo que decidió el negocio el 25/10/2026:
--
-- - Ping Pong se vende solo por 30 min ($100) o 1 h ($150). Sin 90 min ni 2 h.
-- - Cornhole se vende solo por 1 h o 90 min: estándar $280 / $410 y para 2
--   personas $200 / $290. Sin 2 h.
-- - Lo mismo en línea que en el local, así que en línea entran 30, 60 y 90 min
--   (cada juego solo ofrece los suyos).
-- - Sin promociones. Se apaga, no se borra: Hugo la puede volver a prender en
--   Ajustes con sus precios.
--
-- Los precios de 30 y 60 min de Ping Pong y de 60 y 90 min de Cornhole son los
-- que dio el negocio; para 2 personas se conservan los que haya y solo se
-- quita la de 2 horas. Las reservas ya hechas conservan su precio y su tiempo:
-- una de 2 horas que ya existe se juega igual.

update public.configuracion
set datos = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            datos,
            '{deportes,pingpong,duraciones}', '[30, 60]'
          ),
          '{deportes,pingpong,precios}', '{"30": 100, "60": 150}'
        ),
        '{deportes,cornhole,duraciones}', '[60, 90]'
      ),
      '{deportes,cornhole,precios}', '{"60": 280, "90": 410}'
    ),
    -- coalesce: jsonb_set con un valor NULL devuelve NULL y borraría toda la
    -- configuración; si no hubiera tabla para 2 personas, se queda en null.
    '{deportes,cornhole,preciosPareja}', coalesce((datos #> '{deportes,cornhole,preciosPareja}') - '120', 'null'::jsonb)
  ),
  '{reglas,duracionesEnLinea}', '[30, 60, 90]'
)
|| jsonb_build_object('promo', (datos -> 'promo') || '{"activa": false}');
