---
version: 1
slug: "src-pantallas-reservar-reservar-tsx"
primary_target: "src/pantallas/reservar/Reservar.tsx"
related_targets: ["src/pantallas/mi-reserva/MiReserva.tsx","src/pantallas/cobro/Cobro.tsx"]
---

# Superficie: sitio de reservas (teléfono)

Modo: Operate. Grupos de amigos reservan y dividen el pago de una mesa en menos de un minuto, solo desde el teléfono. Rutas: /, /r, /c, /pago, /privacidad. Referencia fijada por el usuario: app de reservas de canchas oscura con degradado rojo-naranja ("Club Spark"), con las fotos reales de cada deporte.

## Direction contract

THESIS: Elegir juego es elegir una foto; reservar es deslizar. Rechaza la lista de filas con íconos y el formulario de pasos.

OWN-WORLD: Fondo casi negro cálido #0f0908 con resplandor rojo arriba; vidrio cálido translúcido con filo claro de 1 px; degradado de la casa #cc3d1d→#a8161a para lo elegido y lo accionable; esquinas de 28 px; Hanken Grotesk para todo (Geist lo marcó el detector como sobreusada), Anton solo para el nombre gigante del deporte, en naranja sólido sobre la franja lisa de la foto (sin recortes del objeto no va detrás).

STORY: Ve los tres juegos como fotos grandes; toca uno; en su ficha elige cómo pagan, día, tiempo y hora; escribe nombre y WhatsApp; desliza para pagar; recibe su pase.

FIRST VIEWPORT: Marca arriba a la izquierda; "¿Listos para la reta?" grande; la primera tarjeta-foto casi a ancho completo con el nombre gigante del deporte, "N mesas" en pastilla y precio abajo; asoma la segunda.

FORM: Pinned by the user (reference image); roll c003accc acknowledged, assigned index 3 overridden by the pin. Raise from the festival lineup challenger: the giant sport word carries hierarchy by size alone, no extra badge.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
