-- El panel entra con usuario y contraseña, no con correo: solo se usa en el
-- local y nadie necesita recibir correos. La cuenta de Supabase Auth de cada
-- usuario lleva una dirección interna (<usuario>@panel.retasaca.com, ver
-- src/datos/usuarios.ts) a la que nunca se le manda nada.
--
-- En `perfiles` la columna `correo` pasa a ser `usuario` (sigue siendo única).
-- La tabla está vacía cuando se aplica: todavía no hay cuentas del panel.

alter table public.perfiles rename column correo to usuario;

-- La misma regla que revisa el servidor: de 3 a 30, minúsculas, números, punto,
-- guion o guion bajo, empezando con letra o número.
alter table public.perfiles
  add constraint perfiles_usuario_valido check (usuario ~ '^[a-z0-9][a-z0-9._-]{2,29}$');
