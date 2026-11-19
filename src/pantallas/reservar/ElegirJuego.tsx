// La lista de juegos: una tarjeta-foto por deporte con su nombre gigante, las
// mesas que hay y el precio por hora, y la del combo si está prendido. Tocar
// una abre su ficha.

import type { Dispatch } from 'react'
import type { Accion, Borrador } from '../../mecanismos/reserva/estado'
import { LUGAR, mesasEnServicio, ORDEN_DEPORTES, precioDeLista, type Configuracion, type DeporteId } from '../../negocio/configuracion'
import { formatoDinero } from '../../negocio/formato'
import { ahorroDelCombo } from '../../negocio/precios'
import { FOTO_DE } from '../../vista/fotos'
import { cambiarDePantalla } from '../../vista/transicion'

interface Props {
  borrador: Borrador
  despachar: Dispatch<Accion>
  config: Configuracion
}

export function ElegirJuego({ despachar, config }: Props) {
  const abrir = (id: DeporteId) =>
    cambiarDePantalla(() => {
      // Tocar la foto lleva directo a elegir horario. Si es el mismo juego que
      // ya traía, se queda lo que había elegido (modalidad, palas, hora).
      despachar({ tipo: 'elegirDeporte', deporte: id, config })
      despachar({ tipo: 'irAPaso', paso: 2, config })
    })
  const abrirCombo = () =>
    cambiarDePantalla(() => {
      despachar({ tipo: 'elegirCombo' })
      despachar({ tipo: 'irAPaso', paso: 2, config })
    })

  // La tarjeta presume el ahorro mayor ("hasta") y el precio menor ("desde"):
  // cada modalidad tiene el suyo y se ven en la ficha.
  const ahorros = (['estandar', 'pareja'] as const).map((m) => ahorroDelCombo(config, m)?.ahorro ?? 0)
  const ahorroMayor = Math.max(...ahorros)
  const desde = Math.min(config.combo.precios.estandar, config.combo.precios.pareja)

  return (
    <>
      <header className="inicio-marca">
        <img src="/imagenes/logo-completo.png" alt="Reta Saca" width="115" height="72" />
      </header>

      <h1 className="inicio-titulo" aria-label="¿Estás listo para la reta?">
        <span className="inicio-titulo-1">¿Estás listo para</span>{' '}
        {/* "LA RETA?" es un SVG: el contorno con degradado no se puede hacer con
            -webkit-text-stroke, que solo acepta un color. `textLength` lo ajusta
            al ancho exacto de la columna. El nombre completo del título para
            lectores de pantalla va en el aria-label del h1. */}
        <svg className="inicio-titulo-2" viewBox="0 0 860 132" aria-hidden="true">
          <defs>
            <linearGradient id="degradado-reta" x1="0" y1="0" x2="1" y2="0.35">
              <stop offset="0" stopColor="#ffc15e" />
              <stop offset="0.55" stopColor="#ff7a45" />
              <stop offset="1" stopColor="#ff4b3a" />
            </linearGradient>
          </defs>
          <text x="2" y="122" textLength="852">
            LA RETA?
          </text>
        </svg>
        {/* Adorno: el parche de malla detrás de "reta?" y los trazos de chispa. */}
        <span className="inicio-malla" aria-hidden="true" />
        <svg className="inicio-chispas" viewBox="0 0 358 150" aria-hidden="true">
          <path d="M250 12l-7-10M262 10l3-11M273 14l9-8" />
          <path d="M352 54l12-6M354 66l13 1" />
          <path d="M14 126l-12 8M28 130l-6 11" />
        </svg>
      </h1>

      <ul className="juegos">
        {ORDEN_DEPORTES.map((id) => {
          const d = config.deportes[id]
          const precio = precioDeLista(d)
          const foto = FOTO_DE[id]
          return (
            <li key={id}>
              <button type="button" className="juego" onClick={() => abrir(id)}>
                <img className={`juego-foto foto-${id}`} src={foto.src} alt="" style={{ objectPosition: foto.enfoque }} />
                <span className="juego-palabra" aria-hidden="true">
                  {d.nombre}
                </span>
                <span className="juego-pie">
                  <strong className="juego-nombre">{d.nombre}</strong>
                  {precio !== undefined && (
                    <span className="juego-precio numeros">
                      <b>{formatoDinero(precio)}</b> /hora
                    </span>
                  )}
                </span>
                <span className="pastilla juego-mesas numeros">
                  {mesasEnServicio(d)} {mesasEnServicio(d) === 1 ? LUGAR[id].uno : LUGAR[id].varios}
                </span>
              </button>
            </li>
          )
        })}
        {/* El combo: las dos fotos partidas en diagonal, porque son los dos juegos. */}
        {config.combo.activa && (
          <li>
            <button type="button" className="juego juego-combo" onClick={abrirCombo}>
              <img className="juego-foto mitad-uno" src={FOTO_DE.cornhole.src} alt="" style={{ objectPosition: FOTO_DE.cornhole.enfoque }} />
              <img className="juego-foto mitad-dos" src={FOTO_DE.pingpong.src} alt="" style={{ objectPosition: FOTO_DE.pingpong.enfoque }} />
              <span className="juego-palabra" aria-hidden="true">
                Combo
              </span>
              {ahorroMayor > 0 && <span className="pastilla juego-ahorro numeros">Ahorras hasta {formatoDinero(ahorroMayor)}</span>}
              <span className="juego-pie">
                <span>
                  <strong className="juego-nombre">Combo</strong>
                  <span className="juego-detalle">30 min de cada juego</span>
                  <span className="juego-detalle">Para 2 o 4 personas</span>
                </span>
                <span className="juego-precio numeros">
                  desde <b>{formatoDinero(desde)}</b>
                </span>
              </span>
            </button>
          </li>
        )}
      </ul>

    </>
  )
}
