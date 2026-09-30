// Cierre de caja: lo que se cobró un día, por medio. El efectivo es lo que se
// cuadra contra la caja física (RESERVAS.md §10).

import { useState } from 'react'
import { servicio, type PagoDelDia } from '../datos'
import { usarDatos } from '../mecanismos/datos/usarDatos'
import { formatoDinero } from '../negocio/formato'
import type { MedioDePago } from '../negocio/reserva'
import { ahoraEnSonora, fechaLarga, formatoHora, momentoDe } from '../negocio/tiempo'
import { Devoluciones } from './Devoluciones'

const MEDIOS: { medio: MedioDePago; nombre: string }[] = [
  { medio: 'efectivo', nombre: 'Efectivo' },
  { medio: 'tarjeta', nombre: 'Tarjeta' },
  { medio: 'en_linea', nombre: 'En línea (Mercado Pago)' },
]

export function Caja() {
  const [fecha, setFecha] = useState(ahoraEnSonora().fecha)
  const { datos: pagos, error } = usarDatos(() => servicio.pagosDelDia(fecha), [fecha])

  const suma = (lista: PagoDelDia[]) => lista.reduce((s, p) => s + p.monto, 0)
  const vigentes = (pagos ?? []).filter((p) => !p.devuelto)
  const devueltos = (pagos ?? []).filter((p) => p.devuelto)

  return (
    <div>
      <div className="panel-titulo">
        <h1>Caja · {fechaLarga(fecha)}</h1>
        <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
      </div>
      <Devoluciones />
      {error && <p className="panel-error">{error}</p>}
      {!pagos && !error && <p>Cargando…</p>}
      {pagos && (
        <>
          <div className="caja-totales">
            {MEDIOS.map(({ medio, nombre }) => (
              <div key={medio} className={'panel-tarjeta caja-total' + (medio === 'efectivo' ? ' destacada' : '')}>
                <small>{nombre}</small>
                <strong>{formatoDinero(suma(vigentes.filter((p) => p.medio === medio)))}</strong>
              </div>
            ))}
            <div className="panel-tarjeta caja-total">
              <small>Total cobrado</small>
              <strong>{formatoDinero(suma(vigentes))}</strong>
            </div>
          </div>
          {devueltos.length > 0 && <p className="nota">Devuelto por transferencia tras cancelaciones: {formatoDinero(suma(devueltos))} (no cuenta en el total).</p>}
          <table className="panel-tabla">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Folio</th>
                <th>Quién pagó</th>
                <th>Medio</th>
                <th>Marcó</th>
                <th className="derecha">Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagos.length === 0 && (
                <tr>
                  <td colSpan={6} className="nota">
                    No hubo pagos este día.
                  </td>
                </tr>
              )}
              {pagos.map((p) => (
                <tr key={p.parteId} className={p.devuelto ? 'devuelto' : ''}>
                  <td>{formatoHora(momentoDe(Date.parse(p.en)).minutos)}</td>
                  <td>{p.folio}</td>
                  <td>{p.nombre}</td>
                  <td>{MEDIOS.find((m) => m.medio === p.medio)?.nombre}</td>
                  <td>{p.marcadoPor ?? '—'}</td>
                  <td className="derecha">
                    {formatoDinero(p.monto)}
                    {p.devuelto && ' (devuelto)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
