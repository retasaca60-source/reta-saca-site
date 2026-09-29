// Qué página se abre en cada dirección.
//
//   /              reservar (sitio del cliente)
//   /r/<token>     link privado del organizador: su reserva, pagos, cancelar
//   /c/<token>     link de cobro para los amigos
//   /pago/<id>     pago SIMULADO (solo mientras no hay Mercado Pago)
//   /privacidad    aviso de privacidad
//   /panel/…       panel del negocio (recepción y dueño)
//
// Las páginas se cargan por separado (lazy): quien reserva desde el teléfono
// no descarga el panel.

import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Cabecera } from '../vista/Cabecera'
import '../estilos/sitio.css'

const Reservar = lazy(() => import('../pantallas/reservar/Reservar'))
const MiReserva = lazy(() => import('../pantallas/mi-reserva/MiReserva'))
const Cobro = lazy(() => import('../pantallas/cobro/Cobro'))
const PagoSimulado = lazy(() => import('../pantallas/pago-simulado/PagoSimulado'))
const Privacidad = lazy(() => import('../pantallas/privacidad/Privacidad'))
const Panel = lazy(() => import('../panel/Panel'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<SitioCliente />}>
            <Route index element={<Reservar />} />
            <Route path="r/:token" element={<MiReserva />} />
            <Route path="c/:token" element={<Cobro />} />
            <Route path="pago/:id" element={<PagoSimulado />} />
            <Route path="privacidad" element={<Privacidad />} />
            <Route path="*" element={<NoExiste />} />
          </Route>
          <Route path="panel/*" element={<Panel />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

/** El marco del sitio del cliente: barra con el logo, aviso de demostración y la página. */
function SitioCliente() {
  // Cada página abre arriba. Sin esto, al deslizar para pagar desde el fondo de
  // la ficha, la página de pago abría con el desplazamiento de la ficha y en el
  // iPhone se veía en blanco, solo con el botón.
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="sitio">
      <Cabecera />
      <Suspense fallback={<p className="cargando">Cargando…</p>}>
        <Outlet />
      </Suspense>
    </div>
  )
}

function NoExiste() {
  return (
    <>
      <h1 className="titulo-grande" style={{ marginTop: 24 }}>
        Esta página no existe
      </h1>
      <div className="acciones">
        <a className="boton boton-principal" href="/">
          Ir a reservar
        </a>
      </div>
    </>
  )
}
