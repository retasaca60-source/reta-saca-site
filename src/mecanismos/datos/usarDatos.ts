// Cargar datos del servicio en una pantalla y volver a cargarlos solos cuando
// cambian (otra pestaña, recepción marcó un pago, se venció un apartado).

import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorDeDatos, servicio } from '../../datos'

export interface Carga<T> {
  datos: T | undefined
  error: string | null
  cargando: boolean
  recargar: () => void
}

export function usarDatos<T>(cargar: () => Promise<T>, dependencias: readonly unknown[]): Carga<T> {
  const [datos, setDatos] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  // Si llegan dos respuestas fuera de orden, solo cuenta la última pedida.
  const turno = useRef(0)
  const cargarAhora = useCallback(cargar, dependencias)

  const recargar = useCallback(() => {
    const mio = ++turno.current
    setCargando(true)
    cargarAhora().then(
      (d) => {
        if (mio !== turno.current) return
        setDatos(d)
        setError(null)
        setCargando(false)
      },
      (e) => {
        if (mio !== turno.current) return
        setError(mensajeDeError(e))
        setCargando(false)
      },
    )
  }, [cargarAhora])

  useEffect(() => {
    recargar()
    return servicio.alCambiar(recargar)
  }, [recargar])

  return { datos, error, cargando, recargar }
}

/** El texto que ve la persona. Los errores esperados traen su mensaje; los demás, uno genérico. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorDeDatos) return e.message
  console.error(e)
  return 'Algo falló. Intenta de nuevo en un momento.'
}
