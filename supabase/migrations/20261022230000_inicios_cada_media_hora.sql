-- Lo que pidió Hugo el 22/10/2026, un día después de dejar la reserva en línea
-- en 1 o 2 horas y en hora cerrada:
--
-- - En línea se vuelve a empezar a la hora y a la media (5:00, 5:30, 6:00…).
--   La reserva tiene que terminar antes del cierre, así que con 1 h la última
--   es 8:30 PM de lunes a jueves y domingo, y 9:30 PM viernes y sábado.
-- - Regresa la hora y media. Lo único que no se reserva en línea es la media
--   hora de Ping Pong, que era lo que quería quitar.
-- - Para hoy se puede reservar hasta la hora de inicio: sin minutos de corte.
--
-- Solo se tocan esas tres reglas; precios, horario, promo y lo demás se
-- quedan como los tenga el dueño. Los minutos de corte se pueden volver a
-- subir desde Ajustes en el panel.

update public.configuracion
set datos = jsonb_set(
  datos,
  '{reglas}',
  (datos -> 'reglas') || '{"pasoDeInicio": 30, "minutosDeCorte": 0, "duracionesEnLinea": [60, 90, 120]}'
);
