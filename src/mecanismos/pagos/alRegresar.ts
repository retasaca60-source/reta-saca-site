// Cuando alguien sale a Mercado Pago y regresa con "atrás", el navegador
// puede devolver la página tal como la dejó (la caché de ida y vuelta), con
// el botón todavía en "Apartando…" y sin forma de volver a intentarlo. Este
// aviso deja que la pantalla se reacomode al regresar.

import { useEffect, useRef } from 'react'

export function usarAlRegresar(alRegresar: () => void): void {
  const ultimo = useRef(alRegresar)
  ultimo.current = alRegresar
  useEffect(() => {
    const f = (e: PageTransitionEvent) => {
      if (e.persisted) ultimo.current()
    }
    window.addEventListener('pageshow', f)
    return () => window.removeEventListener('pageshow', f)
  }, [])
}