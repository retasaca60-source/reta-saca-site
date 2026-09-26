# Reta Saca

Sitio de reservas de Reta Saca (ping pong, cornhole y popdarts) y panel de
recepción.

| Archivo | Qué es | Estado |
|---|---|---|
| `index.html` | Página de reservas para clientes | Demostración: no guarda nada |
| `recepcion.html` | Panel de recepción (copia del artefacto de Claude) | Solo funciona dentro de claude.ai |
| `logo.png`, `bag-icon.png`, `paddle-icon.png` | Imágenes | — |

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

Abrir `index.html` en el navegador basta. Para que carguen bien las imágenes
y las fuentes, mejor con un servidor local:

```bash
npx serve .
```
