# Contrato de datos: la versión real

Para quien trabaja en **Supabase y Mercado Pago**. La versión real ya existe y
corre en Supabase; cómo quedaron las tablas, los permisos y cómo se sube un
cambio está en [`BASE-DE-DATOS.md`](BASE-DE-DATOS.md). Aquí está el contrato
que cualquier versión tiene que cumplir y lo que falta (Mercado Pago).

## La idea en una línea

Las pantallas **solo** hablan con un objeto `servicio` que cumple la interfaz
`ServicioDeDatos` de [`src/datos/contrato.ts`](src/datos/contrato.ts). Lo
cumplen dos versiones y [`src/datos/index.ts`](src/datos/index.ts) elige cuál
con la variable `VITE_DATOS`:

```
 pantallas (src/pantallas, src/panel)
        │  solo llaman a servicio.algo()
        ▼
 src/datos/index.ts ─► simulado.ts  (demostración: el navegador + pago de mentira)
                    └► real.ts      (VITE_DATOS=real: manda cada acción al servidor)
                                        │
                                        ▼
                         Edge Function `api` en Supabase
                         (src/servidor/api.ts + supabase/fuentes/)
                                        │
            las dos llaman a ▼          ▼
 src/negocio/operaciones/     LAS REGLAS, escritas una sola vez
```

## Las reglas ya están escritas: no las reescribas

Cada operación del contrato (apartar, extender, cambiar horario, asignar mesa,
revisar conflictos de configuración…) tiene su regla como **función pura** en
[`src/negocio/operaciones/`](src/negocio/operaciones/index.ts): recibe la
configuración, las reservas que importan y la hora, y regresa la reserva
resultante o lanza `ErrorDeDatos`. **No guarda nada.**

Tu versión real hace lo mismo que la simulada: **leer → llamar a la operación
→ guardar**. Mira cómo lo hace [`simulado.ts`](src/datos/simulado.ts): ya no
tiene reglas adentro, solo guarda.

Como las reglas deciden cobros, corren **en el servidor**, no en el navegador:

1. `real.ts` (en el navegador) manda `{ accion, datos }` a la **Edge Function
   `api` de Supabase**. No decide nada: ni precios, ni lugares, ni la hora.
2. La función ([`src/servidor/api.ts`](src/servidor/api.ts)) revisa quién
   pide qué, lee de Postgres, llama a la operación de `src/negocio/operaciones`
   con la hora del servidor y guarda.
3. Todo lo que ocupa mesa (apartar, anotar sin reserva, extender, cambiar
   horario…) pasa en **una transacción con candado**
   (`pg_advisory_xact_lock`): dos personas no pueden apartar la última mesa.

Se eligió Supabase y no funciones de Netlify porque Netlify cobra créditos por
cada publicación y por las funciones, y en el plan gratis se acabaron; Supabase
da las Edge Functions gratis de sobra para el tamaño del local.

Si una regla está mal, se corrige **una vez** en `src/negocio/operaciones` y
vale para las dos versiones. Antes vivían dentro de `simulado.ts`: el arreglo
de "cambiar horario" que hiciste había quedado solo en una de las dos.

## Cómo empezar

1. Lee [`RESERVAS.md`](RESERVAS.md): son las reglas que la base tiene que
   hacer cumplir.
2. Lee [`src/datos/contrato.ts`](src/datos/contrato.ts): cada función, qué
   recibe, qué devuelve y qué errores lanza.
3. Lee [`src/negocio/operaciones/`](src/negocio/operaciones/index.ts): las
   reglas de cada operación, que tu versión va a llamar tal cual.
4. Lee [`src/datos/simulado.ts`](src/datos/simulado.ts): un adaptador delgado
   que muestra el patrón leer → operación → guardar.
5. Corre las pruebas: `npm test`. [`src/datos/simulado.test.ts`](src/datos/simulado.test.ts)
   describe, caso por caso, cómo se debe comportar **cualquier** versión.

## Lo que el servidor tiene que garantizar (no el navegador)

El repositorio y el sitio son públicos: cualquiera puede llamar a Supabase con
lo que quiera desde su navegador. Por eso estas reglas se cumplen **en la
base** (la Edge Function `api`, políticas RLS o disparadores),
nunca solo en el código de las pantallas:

| Regla | Por qué en el servidor |
|---|---|
| **Precio** de la reserva y de cada parte | Si lo manda el navegador, cualquiera se aparta una mesa de $300 por $1. |
| **Disponibilidad** al apartar: al menos una mesa libre en TODO el tramo | Dos personas pueden apartar la última mesa al mismo tiempo. Tiene que ser **atómico** (una transacción, con bloqueo o restricción). |
| **Apartado de 10 min** y su vencimiento | El vencimiento lo decide el reloj del servidor. |
| **Hora actual**: corte de 30 min, ventana de 7 días, plazo de cancelación, tolerancia | El reloj del teléfono puede estar mal (uno del equipo tiene la zona horaria de CDMX con hora de Sonora). Usar `now()` de Postgres con `America/Hermosillo`. |
| **Máximo 2 reservas activas por WhatsApp** | Si no, alguien aparta todas las mesas. |
| **Quién ve qué**: el link de cobro **no** devuelve el WhatsApp del organizador ni su token privado | El link de cobro se reenvía en grupos. |
| **Roles**: solo el dueño cambia configuración y usuarios | Recepción no debe poder cambiar precios. |
| **Marcar pagos**: queda quién lo marcó (`marcadoPor`), lo pone el servidor con el usuario de la sesión | Lo que da fe no lo escribe el interesado. |
| **Confirmar un pago en línea**: solo por el aviso (webhook) de Mercado Pago | Si el navegador pudiera decir "ya pagué", cualquiera lo diría. |

Dos trampas de Supabase que conviene tener presentes: "RLS filtra filas, no columnas" (una
política que deja editar la fila deja editar TODAS sus columnas: estados y
firmas se protegen con disparadores o funciones) y "en Supabase, `revoke …
from public` no le quita la función a `anon`" (escribe `revoke execute … from
public, anon` en cada función nueva).

## Las operaciones

Todas son `async`. Los errores esperados se lanzan como `ErrorDeDatos(codigo,
mensaje)`: la pantalla muestra el `mensaje` tal cual, así que escríbelo para
el cliente o para recepción, en español.

### Del cliente (sin sesión)

| Operación | Qué hace | Errores |
|---|---|---|
| `configuracion()` | La configuración vigente (mesas, precios, promo, horario, reglas, WhatsApp del negocio). Pública. | — |
| `disponibilidad(deporte, fecha, duracion)` | Las horas de inicio de ese día con mesas libres (`libres`, 0 = lleno), precio y si lleva promo. Usa `iniciosPosibles` y `mesasLibres` de `src/negocio`. | — |
| `apartar(solicitud)` | Revalida TODO (horario, corte, ventana, límite por WhatsApp, lugar), calcula precio y partes, y crea la reserva **apartada** 10 min. Devuelve la reserva completa (con `tokenPrivado`). | `datos_invalidos`, `fuera_de_horario`, `limite_whatsapp`, `sin_lugar` |
| `iniciarPago(token, parteIds, nombre)` | `token` es el privado o el de cobro. Crea el pago en Mercado Pago (una "preferencia" por las partes elegidas) y devuelve `{ url }` a donde mandar al cliente. Si es el link de cobro, `nombre` es de quien paga. Si el apartado se venció pero la mesa sigue libre, lo renueva. | `no_encontrada`, `no_permitido` (cancelada), `datos_invalidos` (parte ya pagada, nombre vacío) |
| `reservaPorTokenPrivado(token)` | La reserva completa, o `null`. | — |
| `vistaDeCobro(tokenCobro)` | Vista **recortada** (`VistaDeCobro`): sin WhatsApp ni token privado. | — |
| `cancelarComoCliente(tokenPrivado)` | Cancela. Si faltan más de 2 h, devuelve lo pagado en línea (reembolso en Mercado Pago); si faltan menos, cancela sin devolver. Ya empezada, no. | `no_encontrada`, `no_permitido` |

### Del panel (con sesión)

| Operación | Rol | Qué hace |
|---|---|---|
| `sesion()`, `iniciarSesion(usuario, contraseña)`, `cerrarSesion()` | todos | Usuario y contraseña (Supabase Auth por dentro, ver `BASE-DE-DATOS.md`). Cada persona su usuario. |
| `reservasEntre(desde, hasta)` | ambos | Todas las reservas de esas fechas, de cualquier estado, ordenadas por fecha y hora. |
| `pagosDelDia(fecha)` | ambos | Pagos **hechos** ese día (en línea y en el local), para el cierre de caja. |
| `anotarSinReserva(cliente)` | ambos | La caja del mostrador: registra **y cobra** (efectivo o tarjeta, en `cliente.medio`) a un grupo que empieza **ahora**. Revisa horario, lugar y mesa. Guarda quién cobró. |
| `asignarMesa(id, mesa \| null)` | ambos | Mesa concreta ("CH 3"): que exista, funcione y no la tenga otro grupo a esa hora. Marca que llegaron. |
| `marcarPago(id, parteIds, medio, nombre?)` | ambos | Efectivo o tarjeta. Guarda quién lo marcó. |
| `extender(id, minutos)` | ambos | Revisa cierre y lugar; agrega una parte "extension" por cobrar. |
| `cambiarHorario(id, fecha, inicio)` | ambos | Revisa horario y lugar; si el nuevo cuesta más, agrega la diferencia por cobrar. |
| `cancelarComoNegocio(id)` | ambos | Devuelve TODO lo pagado en línea, sin plazo. |
| `liberarPorRetraso(id)` | ambos | Solo pasados los 20 min sin llegar. Sin devolución. |
| `guardarConfiguracion(config, aunqueHayaConflictos?)` | dueño | Si con la nueva configuración alguna reserva futura se queda sin mesa o fuera de horario, **no guarda** y devuelve los conflictos, salvo que venga `aunqueHayaConflictos`. Nunca cancela nada. |
| `usuarios()`, `agregarUsuario(u, contraseña)`, `quitarUsuario()` | dueño | Acceso al panel: el dueño crea la cuenta con usuario y contraseña, sin correos. Nadie se puede quitar a sí mismo. |
| `alCambiar(aviso)` | — | Llama a `aviso()` cuando cambian los datos. Con Supabase: Realtime sobre `reservas`/`partes`. |

## Modelo de datos

Los tipos exactos están en [`src/negocio/reserva.ts`](src/negocio/reserva.ts)
y [`src/negocio/configuracion.ts`](src/negocio/configuracion.ts). Las tablas
como quedaron en Supabase (cada reserva completa en `datos` y las columnas de
búsqueda calculadas de ahí), con su diagrama, están en
[`BASE-DE-DATOS.md`](BASE-DE-DATOS.md#las-tablas).

- **Fechas y horas:** la fecha del negocio es "AAAA-MM-DD" de Sonora y la
  hora son minutos desde medianoche, igual que en el código. Los instantes
  (`apartadaHasta`, `pago.en`) son de la hora del servidor.
- **Folio y tokens:** únicos por restricción en la base. El folio usa
  `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sin 0/O/1/I/L), 5 caracteres; los
  tokens, 14 caracteres al azar.
- **Estados:** `apartada` → `confirmada` (con el primer pago o anotada en
  mostrador) → `cancelada` (con motivo). Un apartado vencido se trata como
  cancelado con motivo `apartado_vencido`.

## Pagos con Mercado Pago

1. `iniciarPago` crea una **preferencia** de Checkout Pro con el monto de las
   partes, `external_reference` = id del intento, `back_urls` a
   `/r/<token>?pago=aprobado` (o `/c/<token>`), y **sin OXXO**
   (`excluded_payment_types: ticket`): se confirma horas después y la mesa no
   puede quedar apartada tanto tiempo.
2. El cliente paga en Mercado Pago y regresa. **Regresar no confirma nada.**
3. El **webhook** de Mercado Pago (una acción nueva de la Edge Function `api`) consulta el pago,
   y si está aprobado marca las partes como pagadas y la reserva como
   confirmada. Si el apartado ya venció y la mesa ya no está, reembolsa y lo
   deja registrado.
4. Reembolsos (cancelaciones): API de reembolsos de Mercado Pago con el
   `mp_pago_id` de cada parte.
5. Las llaves de Mercado Pago van en los secretos de la función (*Edge
   Functions → Secrets* en Supabase), **nunca** en el código ni con prefijo
   `VITE_` (lo que empieza con `VITE_` se publica en el sitio).

Mientras no haya Mercado Pago, la pantalla `/pago/<id>`
(`src/pantallas/pago-simulado`) ocupa su lugar en las dos versiones; en la real
solo funciona si la función tiene el secreto `PAGOS_SIMULADOS=si`. Cuando entre
Mercado Pago se quita ese secreto y `iniciarPago` devuelve la URL de Mercado
Pago.

## Casos que la versión real debe pasar

Son los de `src/datos/simulado.test.ts`, y **ya corren contra las dos
versiones**: la simulada y la real (el mismo servidor de Supabase, con la base
en memoria, `src/servidor/conexionEnMemoria.ts`). `npm test` las corre todas.

- Aparta con precio por mesa y lo divide en pesos cerrados ($150 entre 4 →
  39/37/37/37).
- Popdarts siempre queda en un solo pago.
- Queda firme con el primer pago.
- No vende una mesa de más, ni con dos personas al mismo tiempo.
- Un apartado ocupa mesa 10 min y luego se libera solo.
- Máximo 2 reservas activas por WhatsApp.
- No deja reservar fuera de horario, pasado el corte ni más allá de 7 días.
- El link de cobro no enseña el WhatsApp del organizador.
- Un amigo paga su parte con su nombre, o "lo que falta".
- No se paga dos veces la misma parte.
- Cancelar hasta 2 h antes devuelve; después cancela sin devolver.
- Sin sesión no se ven reservas; recepción no cambia configuración.
- Marcar pago guarda quién lo marcó.
- No asigna una mesa que ya tiene otro grupo.
- Extender cobra la diferencia de la tabla y revisa lugar.
- Liberar por retraso solo pasada la tolerancia.
- Quitar mesas con reservas encima avisa y no guarda, salvo confirmación; y
  nunca cancela nada.
- Una reserva conserva su precio aunque cambie la configuración.

## Elegir la versión

[`src/datos/index.ts`](src/datos/index.ts) usa la real con
`VITE_DATOS=real`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_LLAVE_PUBLICA` (ver
[`BASE-DE-DATOS.md`](BASE-DE-DATOS.md#el-sitio-con-datos-reales)); sin eso, la
demostración. Así se puede seguir diseñando con datos de ejemplo sin tocar la
base.
