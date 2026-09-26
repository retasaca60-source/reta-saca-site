# Reta Saca

Sitio de reservas de Reta Saca (ping pong, cornhole y popdarts).

Hecho con Vite + React + TypeScript, organizado igual que CiTerritorio: las
reglas del negocio (precios, promos, anticipos) separadas de las pantallas, y
una carpeta por paso de la reserva. **El mapa de qué hay en cada archivo y
dónde buscar un error está en [`src/README.md`](src/README.md).**

| Carpeta | Qué es |
|---|---|
| `src/` | El sitio. Ver `src/README.md`. |
| `public/imagenes/` | Logo e íconos, se sirven tal cual. |
| `referencia/` | El panel de recepción que se hizo como artefacto de Claude. No se publica: solo funciona dentro de claude.ai. Queda como referencia para rehacerlo. |

Estado: **demostración**. Las reservas no se guardan y la disponibilidad es de
ejemplo (`src/negocio/disponibilidad.ts`).

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

`npm test` revisa las reglas de cobro en segundos; `npm run build` revisa los
tipos y compila igual que Netlify. Si alguno falla aquí, fallaría en Netlify:
mejor verlo antes del `git push`.

Para saber qué versión está publicada: en el sitio, "ver código fuente" y
buscar `<meta name="compilacion">`, que trae la fecha y hora de compilación.
