// El panel del negocio (/panel): recepción y el dueño. Pensado para laptop.
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
import { Semana } from './Semana'
import './panel.css'

export default function Panel() {
  const { datos: usuario, cargando } = usarDatos(() => servicio.sesion(), [])

  if (cargando && usuario === undefined) return <div className="panel panel-centro">Cargando…</div>
  if (!usuario) return <Entrar />
  return <Marco usuario={usuario} />
}

function Marco({ usuario }: { usuario: Usuario }) {
  const esDueno = usuario.rol === 'dueno'
  const demo = servicioSimulado
  return (
    <div className="panel">
      <header className="panel-barra">
        <div className="panel-marca">
          Reta <span>Saca</span> <small>panel</small>
        </div>
        <nav className="panel-nav">
          <NavLink to="/panel" end>
            Hoy
          </NavLink>
          <NavLink to="/panel/semana">Semana</NavLink>
          <NavLink to="/panel/caja">Caja</NavLink>
          {esDueno && <NavLink to="/panel/configuracion">Configuración</NavLink>}
        </nav>
        <div className="panel-usuario">
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
          <span>
            {usuario.nombre} · {esDueno ? 'dueño' : 'recepción'}
          </span>
          <button type="button" className="panel-boton" onClick={() => servicio.cerrarSesion()}>
            Salir
          </button>
        </div>
      </header>
      {servicioSimulado && (
        <p className="panel-demo">Demostración: los datos viven en este navegador. El panel y el sitio abiertos aquí comparten reservas; otro aparato no las ve.</p>
      )}
      <main className="panel-contenido">
        <Routes>
          <Route index element={<Hoy usuario={usuario} />} />
          <Route path="semana" element={<Semana />} />
          <Route path="caja" element={<Caja />} />
          <Route path="configuracion" element={esDueno ? <Configuracion /> : <p>Solo el dueño puede cambiar la configuración.</p>} />
        </Routes>
      </main>
    </div>
  )
}

function Entrar() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = async (c = correo, p = contrasena) => {
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
    <div className="panel panel-centro">
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
          Correo
          <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
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
            <button type="button" className="panel-boton" onClick={() => entrar('recepcion@demo.retasaca', '')}>
              Recepción
            </button>
            <button type="button" className="panel-boton" onClick={() => entrar('hugo@demo.retasaca', '')}>
              Hugo (dueño)
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
