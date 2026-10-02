// El panel del negocio (/panel): recepción y el dueño. Pensado para la laptop
// del mostrador: barra lateral de íconos y el contenido a todo lo ancho.
//
// El DISEÑO de estas pantallas se puede cambiar libremente: los estilos viven
// en panel.css y los datos llegan del servicio (contrato.ts). Lo que no se
// cambia sin revisar RESERVAS.md es QUÉ puede hacer cada rol.

import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { servicio, servicioSimulado, type Usuario } from '../datos'
import { mensajeDeError, usarDatos } from '../mecanismos/datos/usarDatos'
import { Caja } from './Caja'
import { Configuracion } from './Configuracion'
import { Hoy } from './Hoy'
import { IconoAjustes, IconoCaja, IconoMesas, IconoSalir, IconoSemana } from './iconos'
import { Semana } from './Semana'
import './panel.css'

export default function Panel() {
  const { datos: usuario, cargando } = usarDatos(() => servicio.sesion(), [])

  if (cargando && usuario === undefined) return <div className="panel-entrada">Cargando…</div>
  if (!usuario) return <Entrar />
  return <Marco usuario={usuario} />
}

function Marco({ usuario }: { usuario: Usuario }) {
  const esDueno = usuario.rol === 'dueno'
  const demo = servicioSimulado
  const iniciales = usuario.nombre
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  // Barra lateral de íconos con su nombre debajo: recepción no tiene que
  // adivinar qué hace cada uno, y el contenido gana todo el ancho.
  return (
    <div className="panel">
      <aside className="panel-lateral">
        <div className="panel-sello" aria-label="Reta Saca">
          R<span>S</span>
        </div>
        <nav className="panel-nav" aria-label="Secciones del panel">
          <NavLink to="/panel" end>
            <IconoMesas />
            Hoy
          </NavLink>
          <NavLink to="/panel/semana">
            <IconoSemana />
            Semana
          </NavLink>
          <NavLink to="/panel/caja">
            <IconoCaja />
            Caja
          </NavLink>
          {esDueno && (
            <NavLink to="/panel/configuracion">
              <IconoAjustes />
              Ajustes
            </NavLink>
          )}
        </nav>
        <button type="button" className="panel-salir" onClick={() => servicio.cerrarSesion()}>
          <IconoSalir />
          Salir
        </button>
      </aside>

      <div className="panel-principal">
        <header className="panel-barra">
          {demo && (
            <button
              type="button"
              className="panel-boton discreto"
              title="Borra todo lo guardado en este navegador y vuelve a las reservas de ejemplo"
              onClick={() => confirm('¿Borrar todo y volver a los datos de ejemplo?') && demo.restablecer()}
            >
              Restablecer demo
            </button>
          )}
          <div className="panel-persona">
            <span className="panel-avatar" aria-hidden>
              {iniciales}
            </span>
            <span>
              <strong>{usuario.nombre}</strong>
              <small>{esDueno ? 'Dueño' : 'Recepción'}</small>
            </span>
          </div>
        </header>
        {servicioSimulado && (
          <p className="panel-demo">Demostración: los datos viven en este navegador. El panel y el sitio abiertos aquí comparten reservas; otro aparato no las ve.</p>
        )}
        <main className="panel-contenido">
          <Routes>
            <Route index element={<Hoy />} />
            <Route path="semana" element={<Semana />} />
            <Route path="caja" element={<Caja />} />
            <Route path="configuracion" element={esDueno ? <Configuracion /> : <p>Solo el dueño puede cambiar la configuración.</p>} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Entrar() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = async (c = usuario, p = contrasena) => {
    setEnviando(true)
    setError(null)
    try {
      await servicio.iniciarSesion(c, p)
    } catch (e) {
      setError(mensajeDeError(e))
      setEnviando(false)
    }
  }

  return (
    <div className="panel-entrada">
      <form
        className="panel-tarjeta panel-entrar"
        onSubmit={(e) => {
          e.preventDefault()
          entrar()
        }}
      >
        <div className="panel-marca">
          Reta <span>Saca</span> <small>panel</small>
        </div>
        <label>
          Usuario
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </label>
        <label>
          Contraseña
          <input type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        </label>
        {error && <p className="panel-error">{error}</p>}
        <button type="submit" className="panel-boton primario" disabled={enviando}>
          Entrar
        </button>
        {servicioSimulado && (
          <div className="panel-demo-entrar">
            <p>Demostración: la contraseña no se revisa. Entra como:</p>
            <button type="button" className="panel-boton" onClick={() => entrar('recepcion', '')}>
              Recepción
            </button>
            <button type="button" className="panel-boton" onClick={() => entrar('hugo', '')}>
              Hugo (dueño)
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
