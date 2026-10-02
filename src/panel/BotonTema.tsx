import { useEffect, useState } from 'react'

export function BotonTema() {
  const [tema, setTema] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('tema-panel') === 'light'
      ? 'light'
      : 'dark'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    localStorage.setItem('tema-panel', tema)
  }, [tema])

  function cambiarTema() {
    setTema(actual => actual === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      className="panel-boton"
      onClick={cambiarTema}
      aria-label={
        tema === 'dark'
          ? 'Cambiar a modo claro'
          : 'Cambiar a modo oscuro'
      }
    >
      {tema === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro'}
    </button>
  )
}