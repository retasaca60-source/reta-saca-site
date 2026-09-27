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

import { lazy, Suspense } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { Cabecera } from '../vista/Cabecera'

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

/** El marco del teléfono: logo, aviso de demostración y la página. */
function SitioCliente() {
  return (
    <div className="app">
      <Cabecera />
      <Suspense fallback={<div className="card cargando">Cargando…</div>}>
        <Outlet />
      </Suspense>
    </div>
  )
}

function NoExiste() {
  return (
    <div className="card">
      <h2 className="section-title">Esta página no existe</h2>
      <a className="btn btn-primary" href="/">
        Ir a reservar
      </a>
    </div>
  )
}
