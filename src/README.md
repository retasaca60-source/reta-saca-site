# Dónde está cada cosa

Esta carpeta está organizada para responder rápido una sola pregunta: **algo
falla, ¿dónde miro?**

```
src/
├── main.tsx                 La entrada. index.html apunta aquí.
│
├── app/
│   └── App.tsx              Qué pantalla se ve según el paso.
│
├── negocio/                 Las reglas del negocio. Sin pantallas, sin React.
│   ├── catalogo.ts          Deportes, mesas, PRECIOS, duraciones, horario, anticipos.
│   ├── precios.ts           Cuánto se cobra, cuándo hay promo, qué se paga al reservar.
│   ├── disponibilidad.ts    Cuántas mesas quedan (hoy de ejemplo), mesa y folio.
│   ├── formato.ts           Cómo se escriben fechas, horas, dinero y teléfonos.
│   └── precios.test.ts      Las reglas de arriba, escritas como pruebas.
│
├── mecanismos/
│   └── reserva/estado.ts    En qué va la reserva y cómo cambia con cada toque.
│
├── pantallas/               Lo que se ve. Una carpeta por paso.
│   ├── deporte/             Paso 1: deporte y jugadores.
│   ├── horario/             Paso 2: día, duración y hora.
│   ├── datos/               Paso 3: nombre, WhatsApp y resumen de pago.
│   └── reserva-lista/       Paso 4: folio y mesa.
│
├── vista/                   Piezas que se ven en todas las pantallas.
│   ├── Cabecera.tsx         Logo y aviso de demostración.
│   ├── Progreso.tsx         La barra Deporte · Horario · Datos.
│   └── Iconos.tsx
│
└── estilos/                 Lo que comparten todas las pantallas.
    ├── tokens.css           Los colores (claro y oscuro). Un color nuevo, aquí.
    ├── base.css
    └── componentes.css      Tarjetas, chips, campos, resumen y botones.
```

Cada pantalla trae su propio `.css` al lado; lo que usan varias vive en
`estilos/componentes.css`.

## Cómo buscar

| Síntoma | Dónde mirar |
|---|---|
| Un precio está mal | `negocio/catalogo.ts` (el número) o `negocio/precios.ts` (la regla) |
| La promo sale cuando no debe, o no sale | `negocio/precios.ts` → `esHorarioPromo` |
| El anticipo o "en el lugar" no cuadra | `negocio/precios.ts` → `anticipoPara` |
| Aparece una hora que termina después del cierre | `negocio/catalogo.ts` → `CIERRE_EN_MINUTOS` |
| "Lleno" o "Quedan 2" raros | `negocio/disponibilidad.ts` |
| Se borra la hora elegida, o salta de paso | `mecanismos/reserva/estado.ts` → `reducir` |
| No deja confirmar con los datos bien puestos | `mecanismos/reserva/estado.ts` → `datosCompletos` |
| Un texto o botón de un paso se ve mal | `pantallas/<paso>/` |
| Un color está mal en modo oscuro | `estilos/tokens.css` |

## Reglas al añadir

- **Un número del negocio no se escribe en una pantalla.** Va en
  `catalogo.ts`, así hay un solo lugar donde cambiarlo.
- **Una regla de cobro nueva lleva su prueba** en `precios.test.ts`. `npm test`
  corre en segundos.
- **Los datos de una pantalla viven con la pantalla.** Lo que sube a `vista/`
  o a `estilos/componentes.css` tiene que usarse desde al menos dos pasos.
- Nombres y comentarios en español; el comentario explica **por qué**, no qué.
