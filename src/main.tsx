import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos/tokens.css'
import './estilos/base.css'
import App from './app/App'
import { recargarSiFaltaUnArchivo } from './mecanismos/recarga/recarga'
import { iniciarVigilancia } from './mecanismos/vigilancia/vigilancia'

iniciarVigilancia()
recargarSiFaltaUnArchivo()

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
