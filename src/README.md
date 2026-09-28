# Dónde está cada cosa

Esta carpeta está organizada para responder rápido una sola pregunta: **algo
falla, ¿dónde miro?**

```
src/
├── main.tsx                   La entrada. index.html apunta aquí.
├── app/App.tsx                Qué página se abre en cada dirección (/, /r, /c, /panel…).
│
├── negocio/                   LAS REGLAS. Sin pantallas, sin React, con pruebas.
│   ├── configuracion.ts       Lo que Hugo edita: mesas, precios, promo, horario, reglas.
│   │                          CONFIGURACION_INICIAL = con qué arranca.
│   ├── reserva.ts             Qué es una reserva, sus partes y pagos; cancelar, liberar.
│   ├── horario.ts             Qué días y horas se pueden reservar.
│   ├── precios.ts             Precio por mesa, promo, extensiones.
│   ├── disponibilidad.ts      Cuántas mesas quedan libres en un tramo.
│   ├── tiempo.ts              La hora de Sonora, fechas "AAAA-MM-DD", minutos.
│   ├── formato.ts             Dinero y teléfonos.
│   ├── identificadores.ts     Folios (RS-4KD9Q), códigos de links e ids.
│   ├── errores.ts             ErrorDeDatos: el error con mensaje para la persona.
│   ├── operaciones/           CADA OPERACIÓN (apartar, extender, cambiar horario…)
│   │                          como función pura. Las usan la versión simulada y la real.
│   └── negocio.test.ts        Las reglas de RESERVAS.md, como pruebas.
│
├── datos/                     EL CONTRATO con los datos (ver CONTRATO-DE-DATOS.md).
│   ├── contrato.ts            Las operaciones que usan las pantallas. La ley.
│   ├── simulado.ts            La versión de hoy: lee y guarda en el navegador, llama a operaciones.
│   ├── ejemplos.ts            Reservas y usuarios de demostración (solo simulado).
│   ├── simulado.test.ts       Cómo se debe comportar CUALQUIER versión.
│   └── index.ts               Cuál versión se usa. Las pantallas importan de aquí.
│
├── mecanismos/                Lo que funciona por debajo de las pantallas.
│   ├── reserva/estado.ts      Lo que el cliente va eligiendo antes de pagar.
│   ├── datos/usarDatos.ts     Cargar datos y recargarlos solos cuando cambian.
│   └── whatsapp/enlaces.ts    Botones que abren WhatsApp con el mensaje escrito.
│
├── pantallas/                 El sitio del cliente (teléfono). Una carpeta por página.
│   ├── reservar/              "/": deporte y cómo pagan → horario → datos.
│   ├── pago-simulado/         "/pago/…": ocupa el lugar de Mercado Pago (solo demo).
│   ├── mi-reserva/            "/r/…": link privado del organizador.
│   ├── cobro/                 "/c/…": link de cobro para los amigos.
│   └── privacidad/            "/privacidad": aviso (borrador).
│
├── panel/                     "/panel": recepción y dueño (laptop).
│   ├── Panel.tsx              Entrar, barra y navegación.
│   ├── Hoy.tsx                Mesas ahora, clientes sin reserva, reservas del día.
│   ├── FilaReserva.tsx        Una reserva y sus acciones (sentar, cobrar, extender…).
│   ├── Semana.tsx · Caja.tsx · Configuracion.tsx
│   └── panel.css              TODO el diseño del panel. Se puede rehacer libre.
│
├── vista/                     Piezas que usan varias páginas del cliente.
└── estilos/                   Colores (tokens.css) y piezas compartidas del cliente.
```

## Cómo buscar

| Síntoma | Dónde mirar |
|---|---|
| Un precio está mal | En el panel → Configuración (es un dato). Si es la regla: `negocio/precios.ts` |
| La promo sale cuando no debe | `negocio/precios.ts` → `esPromo` |
| Aparece una hora que no debería (cerrado, pasada, muy lejos) | `negocio/horario.ts` → `iniciosPosibles` |
| "Lleno" cuando hay mesas, o al revés | `negocio/disponibilidad.ts` → `ocupadasEn` |
| El cobro dividido no cuadra | `negocio/reserva.ts` → `repartir` |
| No deja reservar y no se entiende por qué | `negocio/operaciones/cliente.ts` → `apartar` |
| Algo del panel (sentar, extender, cambiar) hace lo que no debe | `negocio/operaciones/panel.ts` |
| Algo "se borra solo" o salta de paso al reservar | `mecanismos/reserva/estado.ts` → `reducir` |
| Una página no carga o se queda en "Cargando…" | `mecanismos/datos/usarDatos.ts` y la operación del servicio |
| El panel se ve mal | `panel/panel.css` |
| Un color está mal en modo oscuro | `estilos/tokens.css` |

## Reglas al añadir

- **Las pantallas solo hablan con `servicio`** (de `datos/index.ts`). Nada de
  llamar a Supabase directo desde una pantalla: si se necesita algo nuevo, se
  agrega al contrato y a las dos versiones.
- **Una regla del negocio no se escribe en una pantalla ni en una versión de
  datos** (`simulado.ts`, `real.ts`). Va en `negocio/` (las de una operación,
  en `negocio/operaciones/`), con su prueba.
- **Un número del negocio no se escribe en el código**: es configuración.
- Nombres y comentarios en español; el comentario explica **por qué**.
