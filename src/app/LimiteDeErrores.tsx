// Si una pantalla truena al pintarse (un dato con forma inesperada, o no se
// pudo descargar su código porque se publicó una versión nueva mientras
// estaba abierta), en vez de dejar la página en blanco se muestra qué hacer.
// No enseña el error: eso va a la consola, para quien lo revise.

import { Component, type ReactNode } from 'react'

interface Estado {
  fallo: boolean
}

export class LimiteDeErrores extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { fallo: false }

  static getDerivedStateFromError(): Estado {
    return { fallo: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[pantalla]', error)
  }

  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <div className="limite-errores" role="alert">
        <h1>Algo no cargó bien</h1>
        <p>Puede ser la conexión o que acabamos de publicar una versión nueva. Tus datos están a salvo.</p>
        <div className="limite-errores-botones">
          <button type="button" onClick={() => window.location.reload()}>
            Volver a cargar
          </button>
          <button type="button" className="secundario" onClick={() => this.setState({ fallo: false })}>
            Intentar otra vez
          </button>
        </div>
      </div>
    )
  }
}
