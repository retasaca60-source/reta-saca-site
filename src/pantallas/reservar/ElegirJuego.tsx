// La lista de juegos: una tarjeta-foto por deporte con su nombre gigante, las
// mesas que hay y el precio por hora. Tocar una abre su ficha.

import type { Dispatch } from 'react'
import type { Accion, Borrador } from '../../mecanismos/reserva/estado'
import { mesasEnServicio, ORDEN_DEPORTES, precioDeLista, type Configuracion, type DeporteId } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import { AvisoDemo } from '../../vista/AvisoDemo'
import { FOTO_DE } from '../../vista/fotos'
import { cambiarDePantalla } from '../../vista/transicion'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

export function ElegirJuego({ borrador, despachar, config }: Props) {
  const abrir = (id: DeporteId) =>
    cambiarDePantalla(() => {
      // Elegir el deporte suelta la forma de pago; la ficha abre con "uno paga
      // todo" ya marcado (o con la que traía, si es el mismo juego) para que
      // tocar la foto lleve directo a elegir horario. Se ve y se cambia arriba
      // de la ficha. Popdarts no se divide y el reductor ya lo deja en 1.
      const partes = borrador.deporte === id && borrador.partes ? borrador.partes : 1
      despachar({ tipo: 'elegirDeporte', deporte: id, config })
      if (config.deportes[id].seDivide) despachar({ tipo: 'elegirPartes', partes })
      despachar({ tipo: 'irAPaso', paso: 2, config })
    })

  return (
    <>
      <header className="inicio-marca">
        <img src="/imagenes/logo.png" alt="" />
        <strong>Reta Saca</strong>
      </header>

      <h1 className="inicio-titulo">
        ¿Listos para
        <br />
        la reta?
      </h1>
      <AvisoDemo />

      <ul className="juegos">
        {ORDEN_DEPORTES.map((id) => {
          const d = config.deportes[id]
          const precio = precioDeLista(d)
          const foto = FOTO_DE[id]
          return (
            <li key={id}>
              <button
                type="button"
                className="juego"
                aria-label={`${d.nombre}, ${mesasEnServicio(d)} mesas${precio !== undefined ? `, ${formatoDinero(precio)} la hora` : ''}`}
                onClick={() => abrir(id)}
              >
                <img className={`juego-foto foto-${id}`} src={foto.src} alt="" style={{ objectPosition: foto.enfoque }} />
                <span className="juego-palabra" aria-hidden="true">
                  {d.nombre}
                </span>
                <span className="juego-pie" aria-hidden="true">
                  {precio !== undefined && (
                    <span className="juego-precio numeros">
                      <b>{formatoDinero(precio)}</b> /hora
                    </span>
                  )}
                  <span className="pastilla numeros">{mesasEnServicio(d)} mesas</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="inicio-nota">El precio es por mesa, jueguen 2 o 4.</p>
    </>
  )
}
