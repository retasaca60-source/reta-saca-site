// Cuando a un grupo sentado se le acaba la hora, suena un aviso corto (tres
// pitidos) en el aparato donde está abierto "Hoy", para que recepción vaya a la
// mesa aunque no esté mirando la pantalla.
//
// Decisiones:
// - **El tono se genera con Web Audio**, sin archivo de sonido: no hay nada más
//   que descargar y la política de seguridad (_headers) no cambia.
// - **Los navegadores no dejan sonar nada hasta que la persona toca la
//   página.** El audio se despierta con el primer toque o tecla, y otra vez en
//   cada toque si el teléfono lo durmió (pantalla bloqueada, otra app). En
//   iPhone cuenta el toque al soltar (touchend/click), no al apoyar el dedo.
// - **Suena al CRUZAR la hora de fin con el panel abierto, no al abrirlo.** Si
//   ya había mesas cumplidas, para eso está el aviso rojo; si sonara al abrir,
//   sonaría cada vez que alguien cambia de pestaña o recarga.
// - **Si no puede sonar, no pasa nada**: el aviso rojo del plano sigue igual.

import { fin, type Reserva } from '../../negocio/reserva'

/**
 * Grupos sentados a los que se les acabó la hora entre dos lecturas del reloj
 * del mismo día (minutos desde la medianoche), sin los que ya se marcaron
 * como levantados.
 */
export function seAcabaronEntre(reservas: Reserva[], antes: number, ahora: number, yaLevantadas: Set<string>): Reserva[] {
  return reservas.filter((r) => r.estado === 'confirmada' && r.mesa && antes < fin(r) && fin(r) <= ahora && !yaLevantadas.has(r.id))
}

let audio: AudioContext | null = null

function despertar() {
  try {
    audio ??= new AudioContext()
    if (audio.state !== 'running') void audio.resume()
  } catch {
    // Sin Web Audio: no habrá sonido, el aviso rojo sigue.
  }
}

const GESTOS = ['click', 'touchend', 'keydown'] as const

/** Deja el audio listo con el siguiente toque. Devuelve con qué dejar de escuchar. */
export function prepararAlarma(): () => void {
  for (const g of GESTOS) window.addEventListener(g, despertar, { passive: true })
  return () => {
    for (const g of GESTOS) window.removeEventListener(g, despertar)
  }
}

/** Tres pitidos cortos. Callado si nadie ha tocado la página todavía. */
export function sonarAlarma(): void {
  if (!audio || audio.state !== 'running') return
  const t0 = audio.currentTime
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.3
    const tono = audio.createOscillator()
    const volumen = audio.createGain()
    tono.frequency.value = 880
    // Sube y baja en vez de cortar en seco: sin el "clic" de un tono que se corta.
    volumen.gain.setValueAtTime(0.0001, t)
    volumen.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
    volumen.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    tono.connect(volumen).connect(audio.destination)
    tono.start(t)
    tono.stop(t + 0.22)
  }
}
