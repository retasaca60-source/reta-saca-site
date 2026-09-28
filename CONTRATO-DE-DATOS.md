# Contrato de datos: cómo conectar la base de datos real

Para quien hace la parte de **Supabase y Mercado Pago**. Aquí está todo lo que
necesitas para hacer la versión real sin tocar ninguna pantalla.

## La idea en una línea

Las pantallas **solo** hablan con un objeto `servicio` que cumple la interfaz
`ServicioDeDatos` de [`src/datos/contrato.ts`](src/datos/contrato.ts). Hoy la
cumple [`src/datos/simulado.ts`](src/datos/simulado.ts), que guarda en el
navegador. Tu trabajo es escribir **otra** implementación de esa misma
interfaz, `src/datos/real.ts`, que use Supabase y Mercado Pago. Cuando esté,
se cambia una línea en [`src/datos/index.ts`](src/datos/index.ts) y todo el
sitio y el panel pasan a usar datos reales.

```
 pantallas (src/pantallas, src/panel)
        │  solo llaman a servicio.algo()
        ▼
 src/datos/index.ts  ──►  simulado.ts   (hoy: navegador + pago de mentira)
                     └─►  real.ts       (tú: Supabase + Mercado Pago)
```

## Cómo empezar

1. Lee [`RESERVAS.md`](RESERVAS.md): son las reglas que la base tiene que
   hacer cumplir.
2. Lee [`src/datos/contrato.ts`](src/datos/contrato.ts): cada función, qué
   recibe, qué devuelve y qué errores lanza.
3. Lee [`src/datos/simulado.ts`](src/datos/simulado.ts): es **el modelo de
   comportamiento**. Si tu versión se comporta distinto que la simulada en
   algún caso, una de las dos está mal (revísalo contra `RESERVAS.md`).
4. Corre las pruebas: `npm test`. [`src/datos/simulado.test.ts`](src/datos/simulado.test.ts)
   describe, caso por caso, cómo se debe comportar **cualquier** versión.

## Lo que el servidor tiene que garantizar (no el navegador)

El repositorio y el sitio son públicos: cualquiera puede llamar a Supabase con
lo que quiera desde su navegador. Por eso estas reglas se cumplen **en la
base** (funciones de Postgres / RPC, políticas RLS o funciones de Netlify),
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

| Operación | Quién | Qué hace |
|---|---|---|
| `sesion()`, `iniciarSesion(correo, contraseña)`, `cerrarSesion()` | todos | Supabase Auth con correo y contraseña. Cada persona su usuario. |
| `reservasEntre(desde, hasta)` | ambos | Todas las reservas de esas fechas, de cualquier estado, ordenadas por fecha y hora. |
| `pagosDelDia(fecha)` | ambos | Pagos **hechos** ese día (en línea y en el local), para el cierre de caja. |
| `anotarSinReserva(cliente)` | ambos | Reserva que empieza **ahora**, confirmada, una sola parte por cobrar. Revisa lugar y cierre. |
| `asignarMesa(id, mesa \| null)` | ambos | Mesa concreta ("CH 3"): que exista, funcione y no la tenga otro grupo a esa hora. Marca que llegaron. |
| `marcarPago(id, parteIds, medio, nombre?)` | ambos | Efectivo, tarjeta o transferencia. Guarda quién lo marcó. |
| `extender(id, minutos)` | ambos | Revisa cierre y lugar; agrega una parte "extension" por cobrar. |
| `cambiarHorario(id, fecha, inicio)` | ambos | Revisa horario y lugar; si el nuevo cuesta más, agrega la diferencia por cobrar. |
| `cancelarComoNegocio(id)` | ambos | Devuelve TODO lo pagado en línea, sin plazo. |
| `liberarPorRetraso(id)` | ambos | Solo pasados los 20 min sin llegar. Sin devolución. |
| `guardarConfiguracion(config, aunqueHayaConflictos?)` | dueño | Si con la nueva configuración alguna reserva futura se queda sin mesa o fuera de horario, **no guarda** y devuelve los conflictos, salvo que venga `aunqueHayaConflictos`. Nunca cancela nada. |
| `usuarios()`, `agregarUsuario()`, `quitarUsuario()` | dueño | Acceso al panel. Nadie se puede quitar a sí mismo. |
| `alCambiar(aviso)` | — | Llama a `aviso()` cuando cambian los datos. Con Supabase: Realtime sobre `reservas`/`partes`. |

## Modelo de datos

Los tipos exactos están en [`src/negocio/reserva.ts`](src/negocio/reserva.ts)
y [`src/negocio/configuracion.ts`](src/negocio/configuracion.ts). Una
propuesta de tablas (ajústala como veas mejor, mientras el contrato devuelva
lo mismo):

```
configuracion   una sola fila: jsonb con Configuracion (o tablas deportes/horario/dias_cerrados)
perfiles        id (= auth.users.id), nombre, rol ('dueno' | 'recepcion')
reservas        id, folio (único), token_privado (único), token_cobro (único),
                deporte, fecha (date), inicio (int, minutos), duracion (int),
                precio, con_promo, partes_elegidas, organizador_nombre,
                organizador_whatsapp, origen, estado, apartada_hasta (timestamptz),
                mesa, llegaron_en, cancelacion_motivo, cancelada_en, cancelada_por,
                creada_en
partes          id, reserva_id, monto, del_organizador, concepto,
                pago_medio, pago_nombre, pago_en, pago_marcado_por, pago_devuelto,
                mp_pago_id (id del pago en Mercado Pago, para reembolsos)
intentos_pago   id, reserva_id, parte_ids, nombre, monto, mp_preferencia_id, resultado
```

- **Fechas y horas:** la fecha del negocio es un `date` de Sonora y la hora
  son minutos desde medianoche, igual que en el código. Los instantes
  (`apartada_hasta`, `pago_en`) son `timestamptz`.
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
3. El **webhook** de Mercado Pago (una función de Netlify) consulta el pago,
   y si está aprobado marca las partes como pagadas y la reserva como
   confirmada. Si el apartado ya venció y la mesa ya no está, reembolsa y lo
   deja registrado.
4. Reembolsos (cancelaciones): API de reembolsos de Mercado Pago con el
   `mp_pago_id` de cada parte.
5. Las llaves de Mercado Pago van en variables de entorno de Netlify, **nunca**
   en el código ni con prefijo `VITE_` (lo que empieza con `VITE_` se publica
   en el sitio).

La pantalla `/pago/<id>` (`src/pantallas/pago-simulado`) solo existe en la
simulación. Con la versión real, `iniciarPago` devuelve la URL de Mercado Pago
y esa pantalla no se usa.

## Casos que la versión real debe pasar

Son los de `src/datos/simulado.test.ts`. Lo ideal: que esas mismas pruebas
corran también contra `real.ts` apuntando a una base de pruebas.

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

## Cuando esté lista

En [`src/datos/index.ts`](src/datos/index.ts), elegir la versión con una
variable de entorno (`VITE_DATOS=real`) para que pruebas y producción puedan ir
separadas. Con la versión real, el aviso de "Modo demostración" desaparece
solo (`servicio.modo === 'real'`).
