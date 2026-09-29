// "Desliza para pagar": la acción final de la reserva. Deslizar en vez de tocar
// porque aquí se aparta una mesa y se va a cobrar: un toque accidental con el
// pulgar, con el teléfono en la mano y el chat del grupo al lado, no debe
// mandar a pagar.
//
// Se confirma de dos maneras:
//   · con el dedo o el ratón, arrastrando la perilla hasta casi el final;
//   · con teclado o lector de pantalla, activando la perilla (Enter, Espacio o
//     doble toque del lector). Esos clics llegan con `detail === 0`; un toque
//     suelto del dedo llega con `detail >= 1`, y ese solo empuja la perilla para
//     enseñar que se desliza.
//
// Mientras no se puede pagar, la etiqueta dice qué falta, en vez de un botón
// gris que no explica nada.

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { IconoFlechas } from './Iconos'
import './deslizar.css'

interface Props {
  /** Lo que se lee sobre la pista: la acción, o lo que falta para poder hacerla. */
  etiqueta: string
  listo: boolean
  /** Ya se confirmó y se está apartando la mesa. */
  ocupado: boolean
  icono: ReactNode
  onConfirmar: () => void
}

/** Qué tanto hay que llevar la perilla para que cuente. */
const UMBRAL = 0.82

export function Deslizar({ etiqueta, listo, ocupado, icono, onConfirmar }: Props) {
  const pista = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ desde: number; max: number; movio: boolean } | null>(null)
  const posicion = useRef(0)
  const [x, setX] = useState(0)
  const [max, setMax] = useState(1)
  const [arrastrando, setArrastrando] = useState(false)
  const [empujon, setEmpujon] = useState(false)
  const activo = listo && !ocupado

  const mover = (valor: number) => {
    posicion.current = valor
    setX(valor)
  }

  // Si el pago no sale (sin lugar, error de red) la perilla regresa a su sitio.
  useEffect(() => {
    if (ocupado) return
    posicion.current = 0
    setX(0)
  }, [ocupado])

  const recorrido = () => {
    const p = pista.current
    // Ancho de la pista menos la perilla y sus márgenes (deslizar.css).
    return p ? Math.max(1, p.clientWidth - 64) : 1
  }

  const empezar = (e: PointerEvent<HTMLButtonElement>) => {
    if (!activo) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const m = recorrido()
    setMax(m)
    arrastre.current = { desde: e.clientX - posicion.current, max: m, movio: false }
    setArrastrando(true)
  }

  const seguir = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrastre.current
    if (!a) return
    const valor = Math.min(a.max, Math.max(0, e.clientX - a.desde))
    if (Math.abs(valor - posicion.current) > 2) a.movio = true
    mover(valor)
  }

  const soltar = () => {
    const a = arrastre.current
    if (!a) return
    arrastre.current = null
    setArrastrando(false)
    if (posicion.current >= a.max * UMBRAL) {
      mover(a.max)
      onConfirmar()
      return
    }
    mover(0)
    if (!a.movio) {
      // Un toque sin arrastrar: la perilla se asoma para enseñar el gesto.
      setEmpujon(false)
      requestAnimationFrame(() => setEmpujon(true))
    }
  }

  const avance = Math.min(1, x / max)
  const estilo = { '--x': `${x}px`, '--avance': avance } as CSSProperties

  return (
    <div
      ref={pista}
      className={'deslizar' + (activo || ocupado ? ' listo' : '') + (arrastrando ? ' arrastrando' : '') + (empujon ? ' empujon' : '')}
      style={estilo}
    >
      <span className="deslizar-relleno" aria-hidden="true" />
      <span className="deslizar-etiqueta" aria-live="polite">
        {etiqueta}
      </span>
      <span className="deslizar-flechas" aria-hidden="true">
        <IconoFlechas />
      </span>
      <button
        type="button"
        className="deslizar-perilla"
        aria-label={activo ? `${etiqueta}. Desliza o presiona para confirmar` : etiqueta}
        disabled={!activo}
        onPointerDown={empezar}
        onPointerMove={seguir}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onAnimationEnd={() => setEmpujon(false)}
        onClick={(e) => {
          if (e.detail === 0 && activo) onConfirmar()
        }}
      >
        {icono}
      </button>
    </div>
  )
}
