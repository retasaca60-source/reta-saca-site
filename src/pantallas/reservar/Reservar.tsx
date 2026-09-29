// La página principal. Dos pantallas: la lista de juegos (una foto grande por
// deporte) y la ficha del que se eligió, donde se arma y se paga la reserva
// completa deslizando. El borrador vive aquí para que volver a la lista no
// pierda lo que ya se había elegido.

import { useReducer } from 'react'
import { servicio } from '../../datos'
import { usarDatos } from '../../mecanismos/datos/usarDatos'
import { borradorNuevo, reducir } from '../../mecanismos/reserva/estado'
import { ahoraEnSonora } from '../../negocio/tiempo'
import { ElegirJuego } from './ElegirJuego'
import { Ficha } from './Ficha'
import './reservar.css'

export default function Reservar() {
  const { datos: config, error } = usarDatos(() => servicio.configuracion(), [])
  const [borrador, despachar] = useReducer(reducir, ahoraEnSonora().fecha, borradorNuevo)

  if (error) return <p className="aviso aviso-error">{error}</p>
  if (!config) return <p className="cargando">Cargando…</p>

  const props = { borrador, despachar, config }
  // El paso 3 del borrador (datos) ya no es otra pantalla: está dentro de la ficha.
  return borrador.paso === 1 ? <ElegirJuego {...props} /> : <Ficha {...props} />
}
