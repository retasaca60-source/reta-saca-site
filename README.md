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
4. **[`CLAUDE.md`](CLAUDE.md)**: las reglas para escribir código aquí (también
   las leen Claude y otros asistentes).

## Qué hay en el repositorio

| Carpeta o archivo | Qué es |
|---|---|
| `RESERVAS.md` | Las reglas del negocio y las decisiones tomadas. |
| `src/` | El sitio (Vite + React + TypeScript). Ver `src/README.md`. |
| `public/imagenes/` | Logo e íconos; se sirven tal cual. |
| `herramientas/recorrido.js` | Recorre todo el flujo de reserva y da una "huella" para comparar dos versiones. Ver [Antes de subir un cambio](#antes-de-subir-un-cambio). |
| `referencia/` | El panel de recepción que se hizo como artefacto de Claude. No se publica; queda como referencia de lo que el panel real debe hacer. |
| `netlify.toml` | Cómo compila y publica Netlify. |

**Estado hoy:** es una **demostración**. Las reservas no se guardan, no se
cobra y la disponibilidad es inventada. Además, todavía sigue algunas reglas
viejas. La lista exacta de lo que falta, y en qué orden, está en
[`RESERVAS.md` → Qué ya está hecho y qué falta](RESERVAS.md#qué-ya-está-hecho-y-qué-falta).

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
- Si tu cambio **no debería** cambiar nada de lo que ve el cliente (reordenar
  código, separar archivos), compruébalo con `herramientas/recorrido.js`: se
  pega en la consola del navegador antes y después del cambio, **el mismo día**,
  y las dos huellas deben ser iguales. Las instrucciones están al inicio del
  archivo.
- Si cambias una regla del negocio, actualiza **primero** `RESERVAS.md` (con la
  fecha y quién lo decidió) y agrega o ajusta su prueba.

Para saber qué versión está publicada: en el sitio, "ver código fuente" y
buscar `<meta name="compilacion">`, que trae la fecha y hora de compilación.
