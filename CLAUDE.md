# Cómo se trabaja en Reta Saca

Reglas para quien escriba código aquí, persona o asistente (Claude, Cursor,
Codex…). Cada una está porque no seguirla ya costó algo.

## Antes de tocar nada

1. `git pull`: somos dos trabajando en el mismo repositorio.
2. Leer [`RESERVAS.md`](RESERVAS.md). **Es la regla del negocio.** Si el
   código hace algo distinto a lo que dice, el que está mal es el código. Una
   regla que cambia se cambia primero ahí, con fecha y quién lo decidió.
3. Leer [`src/README.md`](src/README.md): dónde vive cada cosa.

## Lo que no se negocia

- **El repositorio es público.** Nada de llaves, contraseñas, tokens ni datos
  de clientes en el código ni en los commits. Van en variables de entorno de
  Netlify. El panel viejo traía su contraseña escrita en el código, y
  cualquiera la leía con "ver código fuente".
- **Nada de lo que decide un cobro se confía al navegador.** Precio,
  disponibilidad, apartado de 10 minutos, quién pagó, la hora: los decide el
  servidor (Supabase / funciones de Netlify). El navegador solo muestra y
  pide. Cualquiera puede mandar lo que quiera desde su navegador.
- **La hora es la de Sonora (`America/Hermosillo`), del servidor.** Nunca la del
  teléfono del cliente ni la de la computadora de quien programa. Una PC del
  equipo tenía la zona de Ciudad de México con la hora de Sonora puesta a
  mano, y todo lo que calculaba en UTC salía una hora atrás.
- **Los números del negocio viven en un solo lugar.** Hoy es
  `src/negocio/catalogo.ts`; cuando exista el panel, será la base de datos. Una
  pantalla nunca escribe un precio, una hora o un número de mesas.
- **Lo que se guarda en el aparato del cliente lo escribió otra versión.** Si se
  lee algo de `localStorage` o similar, se valida campo por campo. Un campo
  nuevo que la versión anterior no guardaba revienta la pantalla entera.

## Antes de subir

1. `npm test` y `npm run build` limpios.
2. **Abrir el sitio y hacer una reserva completa.** Que compile no quiere decir
   que funcione.
3. Si el cambio no debía alterar lo que ve el cliente, comparar con
   `herramientas/recorrido.js` antes y después (el mismo día).
4. Al publicar, confirmar que Netlify sirve lo que compilaste: el nombre de
   `assets/index-*.js` en el sitio publicado es el mismo que el de tu
   `npm run build`, y `<meta name="compilacion">` trae la hora de este
   despliegue.

**Medir, no suponer.** Cuando se reporta que algo funciona o falla, se
muestra la medición (qué se hizo, qué salió), no una impresión.

## Al escribir

- **Nombres, comentarios y commits en español.**
- **Los comentarios explican el porqué**, no el qué: la decisión, lo que se
  descartó, el error que evita. Lo que hace el código ya está en el código.
- **Un error corregido lleva su prueba** para que no regrese (ver
  `src/mecanismos/reserva/estado.test.ts`).
- **Los mensajes de commit cuentan qué se rompía antes y por qué esta
  solución.**
- Una pantalla nueva usa las clases que ya existen (`card`, `chip`, `btn`,
  `summary-row`…) antes de inventar otras.

## El diseño

- Pensado primero para **teléfono**: casi todos los clientes reservan desde el
  celular. Sin desborde horizontal a 375 px de ancho.
- El **panel** se usa en una **laptop** en el mostrador.
- Los colores están en `src/estilos/tokens.css`, con modo claro y oscuro. Un
  color nuevo se declara ahí.
