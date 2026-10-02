// El control del reloj de prueba, en la barra del panel de la demostración:
// mover la hora para revisar cómo se ve todo a otra hora u otro día. Cambia la
// hora del panel Y del sitio abierto en este navegador (comparten el reloj).

import { useEffect, useState } from 'react'
import { desplazamiento, escucharReloj, horaReal, irA, moverReloj } from '../mecanismos/reloj/relojDePrueba'
import { ahoraEnSonora, fechaLarga, formatoHora, horaDe24, instante, minutosDe } from '../negocio/tiempo'

const MINUTO = 60_000

/** 1505 → "1 d 1 h 5 min". */
function textoMovido(minutos: number): string {
  const d = Math.floor(minutos / 1440)
  const h = Math.floor((minutos % 1440) / 60)
  const m = minutos % 60
  return [d && `${d} d`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ') || '0 min'
}

export function RelojDePrueba() {
  const [, setTic] = useState(0)
  useEffect(() => {
    const repintar = () => setTic((n) => n + 1)
    const t = setInterval(repintar, 15_000)
    const dejar = escucharReloj(repintar)
    return () => {
      clearInterval(t)
      dejar()
    }
  }, [])

  const ahora = ahoraEnSonora()
  const movido = desplazamiento()
  const movidoMin = Math.round(Math.abs(movido) / MINUTO)

  return (
    <div className={'reloj-prueba' + (movido ? ' movido' : '')} role="group" aria-label="Reloj de prueba">
      <span className="reloj-hora">
        <small>Reloj de prueba</small>
        <strong>
          {fechaLarga(ahora.fecha)} · {formatoHora(ahora.minutos)}
        </strong>
        {movido !== 0 && (
          <small className="reloj-movido">
            {movido > 0 ? 'adelantado' : 'atrasado'} {textoMovido(movidoMin)}
          </small>
        )}
      </span>
      <button type="button" className="panel-boton" onClick={() => moverReloj(-60 * MINUTO)}>
        −1 h
      </button>
      <button type="button" className="panel-boton" onClick={() => moverReloj(-15 * MINUTO)}>
        −15 min
      </button>
      <button type="button" className="panel-boton" onClick={() => moverReloj(15 * MINUTO)}>
        +15 min
      </button>
      <button type="button" className="panel-boton" onClick={() => moverReloj(60 * MINUTO)}>
        +1 h
      </button>
      <button type="button" className="panel-boton" onClick={() => moverReloj(24 * 60 * MINUTO)}>
        +1 día
      </button>
      <label className="reloj-ir">
        Ir a
        <input
          type="time"
          step={300}
          value={horaDe24(ahora.minutos)}
          onChange={(e) => e.target.value && irA(instante(ahora.fecha, minutosDe(e.target.value)))}
        />
      </label>
      {movido !== 0 && (
        <button type="button" className="panel-boton primario" onClick={horaReal}>
          Hora real
        </button>
      )}
    </div>
  )
}
