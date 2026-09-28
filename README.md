# Reta Saca

Sitio de reservas de Reta Saca: renta de mesas de Ping Pong, tableros de
Cornhole y Popdarts, con pago dividido entre amigos y un panel para recepción.

## Empieza aquí

Si eres nuevo en el proyecto, léelo en este orden:

1. **Este README**: dónde vive todo, cómo trabajamos dos personas sin pisarnos
   y cómo correr el sitio en tu computadora.
2. **[`RESERVAS.md`](RESERVAS.md)**: **las reglas del negocio**, completas:
   horario, precios, promo, pago dividido, cancelaciones, panel, qué ya está
   hecho y qué falta, y el porqué de cada decisión. Si el código y ese documento
   no coinciden, manda el documento.
3. **[`src/README.md`](src/README.md)**: el mapa del código. Qué hay en cada
   archivo y dónde buscar cuando algo falla.
4. **[`CONTRATO-DE-DATOS.md`](CONTRATO-DE-DATOS.md)**: si vas a hacer la base
   de datos (Supabase) o los pagos (Mercado Pago), esto es lo tuyo.
5. **[`CLAUDE.md`](CLAUDE.md)**: las reglas para escribir código aquí (también
   las leen Claude y otros asistentes).

## Qué hay en el repositorio

| Carpeta o archivo | Qué es |
|---|---|
| `RESERVAS.md` | Las reglas del negocio y las decisiones tomadas. |
| `CONTRATO-DE-DATOS.md` | Cómo se conecta la base de datos real sin tocar pantallas. |
| `src/` | El sitio y el panel (Vite + React + TypeScript). Ver `src/README.md`. |
| `public/imagenes/` | Logo e íconos; se sirven tal cual. |
| `referencia/` | El panel viejo que se hizo como artefacto de Claude. Solo referencia. |
| `netlify.toml` | Cómo compila y publica Netlify. |

## En qué estado está

**Todo funciona "como si fuera real", pero con datos simulados:**

- **El sitio del cliente** (`/`): reservar con las reglas de `RESERVAS.md`,
  pagar entre 1, 2 o 4, pago simulado de Mercado Pago, link privado (`/r/…`)
  y link de cobro para los amigos (`/c/…`).
- **El panel** (`/panel`): mesas ahora, clientes sin reserva, sentar, cobrar en
  el local, extender, cambiar horario, cancelar, liberar, semana, caja del día,
  y la configuración de Hugo (mesas, precios, promo, horario, días cerrados,
  usuarios).
- **Los datos viven en el navegador** (`src/datos/simulado.ts`): el celular del
  cliente y la laptop de recepción NO ven lo mismo todavía. Eso llega con
  Supabase.

Lo que falta para abrir de verdad está en
[`RESERVAS.md` → Qué ya está hecho y qué falta](RESERVAS.md#qué-ya-está-hecho-y-qué-falta).

### Cómo nos repartimos

| Quién | Qué | Dónde |
|---|---|---|
| ARAAM | Diseño del panel y del sitio | `src/panel/panel.css`, `src/pantallas/`, `src/estilos/` |
| Alezzz123 | Base de datos (Supabase) y pagos (Mercado Pago) | `src/datos/real.ts` (nuevo), siguiendo `CONTRATO-DE-DATOS.md` |

Los dos pueden trabajar a la vez sin pisarse: el diseño no toca `src/datos/` y
la base no toca pantallas. Lo que los une es `src/datos/contrato.ts`: **si
alguno necesita cambiarlo, se avisa al otro** (un cambio ahí obliga a ajustar
las dos versiones).

### Skills para Claude Code

El repositorio trae skills en `.claude/skills/` (se reciben con `git pull`;
`skills-lock.json` dice de dónde salió cada una). Claude Code las usa solo al
abrir este proyecto:

| Skill | Para qué | Cuándo |
|---|---|---|
| `codebase-design` | Diseñar módulos "profundos": mucha lógica detrás de una interfaz chica, con uniones limpias. Es la idea del contrato de datos. | Al crear o reorganizar una parte del código. |
| `thermo-nuclear-code-quality-review` | Revisión muy estricta contra código espagueti: nada de `if` sueltos, archivos de más de 1,000 líneas, capas que solo pasan datos. | **Antes de subir un cambio grande.** Se llama a mano: `/thermo-nuclear-code-quality-review`. |
| `supabase` · `supabase-postgres-best-practices` | Auth, RLS, migraciones, índices y trampas de seguridad de Supabase (oficiales). | Toda la parte de la base de datos. |
| `vercel-react-best-practices` | Patrones de React para que las pantallas no se vuelvan lentas ni enredadas. | Al tocar pantallas. Ojo: trae reglas de Next.js (componentes de servidor) que **no aplican** aquí: esto es Vite, todo corre en el navegador. |

Para Mercado Pago existe el plugin **oficial** `mp-integrate`
(`mercadopago/mercadopago-claude-marketplace`). Es un plugin de Claude Code, no
una skill suelta: se instala cuando haya cuenta del negocio, con
`/plugin marketplace add mercadopago/mercadopago-claude-marketplace`.

Antes de agregar otra skill: leer su contenido, preferir fuentes oficiales o
con más de 1,000 instalaciones, e instalarla con `--copy` (en Windows los
enlaces simbólicos de `.claude/skills` no se siguen).

### Probar la demostración

- Sitio: `http://localhost:5190/` (o `reta-saca.netlify.app`).
- Panel: `http://localhost:5190/panel`. En la demostración hay dos botones para
  entrar como **Recepción** o como **Hugo (dueño)**; la contraseña no se revisa.
- Trae reservas de ejemplo (mañana a las 7 PM Cornhole está lleno).
  **"Restablecer demo"** en el panel borra todo y vuelve a empezar.
- Abre el sitio y el panel en dos pestañas del mismo navegador: lo que reserves
  en una aparece en la otra.

## Dónde está

- Código: https://github.com/retasaca60-source/reta-saca-site (público: en un
  repositorio privado, Netlify gratis solo publica los cambios de UNA persona,
  y somos dos). Nada secreto va en el código: contraseñas y llaves, en variables de
  entorno de Netlify.
- Sitio: https://reta-saca.netlify.app — se publica solo con cada `git push`
  a `main`. Por ahora el proyecto de Netlify es **privado**: solo lo ve quien
  entra con la cuenta del equipo. Se abre al público con "Make public" en
  Netlify cuando el sitio esté listo.
- Un Pull Request genera su propia vista previa en Netlify, con su enlace en
  el PR, para revisar antes de mezclar a `main`.

## Cómo trabajamos dos personas sin pisarnos

Todo vive en este repositorio de GitHub. La regla es una:
**antes de empezar, traer lo del otro; al terminar, subir lo tuyo.**

```bash
git pull                      # 1. traer lo que subió la otra persona
# ... hacer cambios ...
git add -A
git commit -m "Qué cambié y por qué"
git push                      # 2. subirlo para que el otro lo vea
```

- Si `git push` responde que hay cambios nuevos, primero `git pull` y luego
  otra vez `git push`.
- Si los dos tocaron las mismas líneas, git marca el conflicto en el archivo
  con `<<<<<<<` y `>>>>>>>`: se deja la versión correcta, se borran las marcas
  y se hace commit.
- Cambios grandes o que el otro debe revisar: en una rama aparte
  (`git switch -c nombre-del-cambio`) y un Pull Request en GitHub.
- Los mensajes de commit, en español, cuentan **qué se rompía antes y por qué
  esta solución**; no solo "arreglos".

### La primera vez (clonar)

```bash
git clone https://github.com/retasaca60-source/reta-saca-site.git
```

Para poder subir cambios, tu usuario de GitHub tiene que haber aceptado la
invitación al repositorio (llega por correo, o en
https://github.com/retasaca60-source/reta-saca-site/invitations).

## Ver el sitio en tu computadora

La primera vez, instalar lo necesario (pide Node 20.19 o más nuevo):

```bash
npm install
```

Después, cada vez:

```bash
npm run dev
```

y abrir http://localhost:5190. Los cambios se ven al guardar, sin recargar.

## Antes de subir un cambio

```bash
npm test
```

```bash
npm run build
```

- `npm test` revisa en segundos las reglas de cobro y los errores que ya se
  corrigieron (`src/**/*.test.ts`).
- `npm run build` revisa los tipos y compila igual que Netlify. Si falla aquí,
  fallaría en Netlify: mejor verlo antes del `git push`.
- **Abre el sitio y haz una reserva completa** (deporte → horario → datos →
  confirmación). Que compile no quiere decir que funcione.
- Si tocaste el panel, entra como Recepción y como Hugo y prueba lo que
  cambiaste (sentar, cobrar, configuración).
- Si cambias una regla del negocio, actualiza **primero** `RESERVAS.md` (con la
  fecha y quién lo decidió) y agrega o ajusta su prueba.

Para saber qué versión está publicada: en el sitio, "ver código fuente" y
buscar `<meta name="compilacion">`, que trae la fecha y hora de compilación.
