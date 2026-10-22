-- Cambios que pidió el negocio el 21/10/2026 y el paso de Mercado Pago a Clip.
--
-- 1. Cada intento de pago apunta el id de su cobro en Clip. Al regresar de
--    Clip, el navegador solo trae el id del intento: con esto el servidor le
--    pregunta a Clip si ese cobro se pagó, sin esperar a que Clip avise.
--    (Con Mercado Pago no hacía falta: el id del pago venía en la dirección.)

alter table public.intentos_pago add column if not exists cobro_id text;

-- 2. La configuración vigente se pone al día. El código ya entiende la forma
--    vieja (normalizarConfiguracion), pero los PRECIOS y el HORARIO son
--    decisiones del negocio y no se adivinan: se escriben aquí, una vez.
--    Lo demás (mesas, fuera de servicio, días cerrados, WhatsApp, tolerancia)
--    se queda como lo tenga el dueño.
--
--    - Sale Popdarts.
--    - Cornhole estándar (4 personas): 1 h $280, 1:30 $410, 2 h $540.
--      Cornhole para 2 personas: 1 h $200, 1:30 $290, 2 h $380.
--    - Ping Pong: 2 palas extra por $50 (el juego trae 2).
--    - Horario: lunes a jueves 5–10 PM; viernes 5–11 PM; sábado 9–12 y
--      5–11 PM; domingo 9–12 y 5–10 PM.
--    - En línea solo se empieza en hora cerrada (paso de 60 min) y solo se
--      reserva 1 o 2 horas. La promo queda a las 5:00 PM.
--    - Ya no se divide el pago: sale `seDivide`.

update public.configuracion
set datos = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            datos #- '{deportes,popdarts}' #- '{deportes,pingpong,seDivide}' #- '{deportes,cornhole,seDivide}' #- '{reglas,horasParaCancelar}',
            '{deportes,cornhole,precios}', '{"60": 280, "90": 410, "120": 540}'
          ),
          '{deportes,cornhole,preciosPareja}', '{"60": 200, "90": 290, "120": 380}'
        ),
        '{deportes,cornhole,precioPalasExtra}', 'null'
      ),
      '{deportes,pingpong,precioPalasExtra}', '50'
    ),
    '{horario}',
    '{
      "0": [{"desde": 540, "hasta": 720}, {"desde": 1020, "hasta": 1320}],
      "1": [{"desde": 1020, "hasta": 1320}],
      "2": [{"desde": 1020, "hasta": 1320}],
      "3": [{"desde": 1020, "hasta": 1320}],
      "4": [{"desde": 1020, "hasta": 1320}],
      "5": [{"desde": 1020, "hasta": 1380}],
      "6": [{"desde": 540, "hasta": 720}, {"desde": 1020, "hasta": 1380}]
    }'
  ),
  '{reglas}',
  (datos -> 'reglas') - 'horasParaCancelar' || '{"pasoDeInicio": 60, "duracionesEnLinea": [60, 120]}'
)
|| jsonb_build_object('promo', (datos -> 'promo') || '{"inicios": [1020]}'),
actualizada_en = now()
where id = 1;

-- Ping Pong no tiene modalidad para 2 personas.
update public.configuracion
set datos = jsonb_set(datos, '{deportes,pingpong,preciosPareja}', 'null')
where id = 1;
