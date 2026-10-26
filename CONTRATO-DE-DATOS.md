# Contrato de datos: la versión real

Para quien trabaja en **Supabase y Clip**. La versión real ya existe y
corre en Supabase; cómo quedaron las tablas, los permisos y cómo se sube un
cambio está en [`BASE-DE-DATOS.md`](BASE-DE-DATOS.md). Aquí está el contrato
que cualquier versión tiene que cumplir y cómo se cobra con Clip.

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
| **Confirmar un pago en línea**: solo preguntándole a Clip por el cobro | Si el navegador pudiera decir "ya pagué", cualquiera lo diría. |

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
| `disponibilidad(deporte, fecha, duracion, modalidad?)` | Las horas de inicio **en línea** de ese día (solo duraciones de `reglas.duracionesEnLinea`, cada `reglas.pasoDeInicio` minutos) con mesas libres (`libres`, 0 = lleno), el precio de la mesa en esa modalidad (Cornhole para 2 personas) y si lleva promo. | — |
| `apartar(solicitud)` | Revalida TODO (horario, corte, ventana, duración en línea, modalidad, palas, límite de apartados sin pagar, lugar), calcula el precio y crea la reserva **apartada** 10 min con **una sola parte** (mesa + palas extra). Devuelve la reserva completa (con `tokenPrivado`). | `datos_invalidos`, `fuera_de_horario`, `demasiados_intentos`, `sin_lugar` |
| `iniciarPago(token, parteIds, nombre)` | `token` es el privado o el de cobro (reservas divididas de antes del 21/10/2026). Crea el cobro en Clip por las partes elegidas y devuelve `{ url }` a donde mandar al cliente. Si es el link de cobro, `nombre` es de quien paga. Si el apartado ya se venció, falla (la reserva quedó cancelada): hay que apartar otra vez. Si el pago de un apartado vencido llega igual, se acepta solo si la mesa sigue libre; si no, queda como devolución por revisar. | `no_encontrada`, `no_permitido` (cancelada), `datos_invalidos` (parte ya pagada, nombre vacío) |
| `reservaPorTokenPrivado(token)` | La reserva completa, o `null`. | — |
| `vistaDeCobro(tokenCobro)` | Vista **recortada** (`VistaDeCobro`): sin WhatsApp ni token privado. | — |
| `cancelarComoCliente(tokenPrivado)` | Solo suelta un apartado **sin pagar** (la ficha lo usa al cambiar de hora antes de pagar). Lo pagado se cancela desde el panel: los cambios se piden por WhatsApp o Instagram (política 02). | `no_encontrada`, `no_permitido` |

### Del panel (con sesión)

| Operación | Rol | Qué hace |
|---|---|---|
| `sesion()`, `iniciarSesion(usuario, contraseña)`, `cerrarSesion()` | todos | Usuario y contraseña (Supabase Auth por dentro, ver `BASE-DE-DATOS.md`). Cada persona su usuario. |
| `reservasEntre(desde, hasta)` | ambos | Todas las reservas de esas fechas, de cualquier estado, ordenadas por fecha y hora. |
| `pagosDelDia(fecha)` | ambos | Pagos **hechos** ese día (en línea y en el local), para el cierre de caja. Se buscan por la fecha del **pago**, no de la reserva: un cobro de hoy de una reserva movida a otro mes sigue saliendo hoy. |
| `cotizarSinReserva(deporte, duracion)` | ambos | Lo que cuesta un grupo que empieza **ahora**, con la hora y la tarifa del servidor. Es lo que la caja enseña antes de cobrar. |
| `anotarSinReserva(cliente)` | ambos | La caja del mostrador: registra **y cobra** (efectivo o tarjeta, en `cliente.medio`) a un grupo que empieza **ahora**. Revisa horario, lugar y mesa. Guarda quién cobró. Con `cliente.precioEsperado` (el total que se vio y se cobró en mano), si el servidor calcula otro **no registra nada**. |
| `asignarMesa(id, mesa \| null)` | ambos | Mesa concreta ("CH 3"): que exista, funcione y no la tenga otro grupo a esa hora. Marca que llegaron. |
| `marcarPago(id, parteIds, medio, nombre?)` | ambos | Efectivo o tarjeta. Guarda quién lo marcó. |
| `extender(id, minutos)` | ambos | Revisa cierre y lugar; agrega una parte "extension" por cobrar. |
| `cambiarHorario(id, fecha, inicio)` | ambos | Revisa horario y lugar; si el nuevo cuesta más, agrega la diferencia por cobrar. |
| `cancelarComoNegocio(id)` | ambos | Lo pagado en línea queda con `devolucion` por revisar. |
| `devolucionesPorRevisar()` | ambos | Canceladas con devolución pendiente, de cualquier fecha. |
| `resolverDevolucion(id, 'transferida' \| 'sin_devolucion')` | ambos | El negocio ya transfirió (los pagos en línea quedan `devuelto`) o decidió no devolver. Guarda quién y cuándo. |
| `liberarPorRetraso(id)` | ambos | Solo pasados los 20 min sin llegar. Sin devolución. |
| `guardarConfiguracion(config, aunqueHayaConflictos?)` | dueño | Revisa la configuración completa (rangos de las reglas, precios que suben con el tiempo, horarios sin encimarse, fechas que existen). Si con ella alguna reserva que no ha terminado —de cualquier fecha futura, apartados vigentes incluidos— se queda sin mesa, fuera de horario o en una mesa que deja de existir, **no guarda** y devuelve los conflictos, salvo que venga `aunqueHayaConflictos`. Nunca cancela nada. |
| `usuarios()`, `agregarUsuario(u, contraseña)`, `quitarUsuario()` | dueño | Acceso al panel: el dueño crea la cuenta con usuario y contraseña, sin correos. Nadie se puede quitar a sí mismo. |
| `alCambiar(aviso)` | — | Llama a `aviso()` cuando cambian los datos. Con Supabase: Realtime sobre `reservas` (solo con sesión del panel), tras cada acción de este navegador, al volver a la pestaña y cada 30 segundos con la página a la vista (lo que Realtime no cubre: el cliente, la configuración y el paso del tiempo). |

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

## Pagos con Clip

Checkout de Clip ("Checkout Redireccionado", link de pago), sin SDK: son dos
llamadas (`supabase/fuentes/clip.ts`). Reemplazó a Mercado Pago el 21/10/2026.

1. `iniciarPago` crea un **link de pago** por el monto de las partes, con
   `metadata.external_reference` = id del intento, `webhook_url` a la función
   (`?aviso=clip`) y regreso a `/r/<token>` (o `/c/<token>`) con
   `?pago=aprobado|cancelado&intento=<id>`. El link **vence con el apartado**
   (Clip no acepta vencimientos después de las 23:59 de la CDMX: cerca de esa
   hora se recorta). El id del cobro de Clip se guarda en el intento
   (`intentos_pago.cobro_id`).
2. El cliente paga en Clip y regresa con el id del **intento** en la URL. La
   página lo manda al servidor (`verificarPagoEnLinea`) para no esperar el
   aviso. **El id no confirma nada por sí solo.**
3. Clip también avisa a la función. En los dos casos el servidor **le pregunta
   a Clip por el cobro** con su llave y solo cuenta uno `CHECKOUT_COMPLETED`,
   **en MXN y por el monto exacto** del intento. Da igual cuál llegue primero o
   si llega dos veces: se registra una vez (`registrarPagoEnLinea`).
4. Si el pago llega cuando ya no hay mesa (se venció el apartado y otro la
   tomó), la reserva no cambia y el dinero queda como **devolución por
   revisar**, con una nota de qué pasó.
5. **Reembolsos**: los decide el negocio y los hace por el método de pago
   original o en efectivo (`RESERVAS.md` §7).
6. La llave va en los secretos de la función (`CLIP_API_KEY`), **nunca** en el
   código ni con prefijo `VITE_`. Se pone como API_KEY:CLAVE_SECRETA; el servidor manda Basic + base64, como pide Clip. **Clip no acepta llaves de prueba
   en este checkout**: la primera prueba de verdad es un pago real chico.

Sin `CLIP_API_KEY`, la pantalla `/pago/<id>` (`src/pantallas/pago-simulado`)
ocupa el lugar de Clip si la función tiene `PAGOS_SIMULADOS=si`. Con la llave
puesta, esa pantalla deja de funcionar aunque el secreto siga: si no,
cualquiera confirmaría ahí un cobro que nunca pagó.

## Casos que la versión real debe pasar

Son los de `src/datos/simulado.test.ts`, y **ya corren contra las dos
versiones**: la simulada y la real (el mismo servidor de Supabase, con la base
en memoria, `src/servidor/conexionEnMemoria.ts`). `npm test` las corre todas.

- Aparta con precio por mesa, en un solo pago completo.
- Cornhole para 2 personas cobra su tabla y no lleva promo; las palas extra
  se suman a la misma parte.
- En línea, los tiempos de cada juego (hoy 30 min o 1 h en los dos), a la hora o a la media.
- Queda firme con el pago.
- No vende una mesa de más, ni con dos personas al mismo tiempo.
- Un apartado ocupa mesa 10 min y luego se libera solo.
- Máximo 2 apartados sin pagar por WhatsApp.
- No deja reservar fuera de horario, pasado el corte ni más allá de 7 días.
- No se paga dos veces la misma reserva.
- El cliente no cancela lo pagado desde su link; si recepción cancela, lo
  pagado en línea queda por revisar y lo reembolsado deja de contar como cobrado.
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

## Corrección del 19/10/2026: partes con checkout en proceso

- `IntentoDePago.venceEn` guarda el vencimiento enviado a la pasarela. Es
  opcional para leer intentos anteriores, que no tenían este dato.
- `Repositorio.partesEnProceso(reservaId, ahora)` devuelve las partes de
  intentos pendientes cuyo checkout aún no vence.
- `iniciarPago` consulta y bloquea dentro de la transacción existente. Si
  alguna parte ya está en proceso, responde `no_permitido` antes de crear
  otra preferencia.
- `VistaDeCobro.partes[].enProceso` permite elegir otra parte disponible. No
  expone el ID del intento ni datos privados del organizador.
- Si crear la preferencia falla de forma incierta, el bloqueo conserva su
  plazo: una respuesta perdida no demuestra que la pasarela no lo creó.
- Los intentos antiguos sin `venceEn` no quedan protegidos retroactivamente.
  Antes de abrir a cobros reales, resolver los checkouts antiguos de prueba
  y validar el vencimiento de los nuevos en sandbox.
