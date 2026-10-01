// El link privado del organizador (/r/<token>): su pase completo, quién ha
// pagado, compartir el cobro y cancelar. Es también la confirmación al pagar.
// Sin cuenta: quien tiene este link manda sobre la reserva (RESERVAS.md §6).

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { servicio } from '../../datos'
import { mensajeDeError, usarDatos } from '../../mecanismos/datos/usarDatos'
import { direccion, enlaceWhatsApp } from '../../mecanismos/whatsapp/enlaces'
import { formatoDinero } from '../../negocio/formato'
import { pagado, pagadoEnLinea, pendiente, total, type Reserva } from '../../negocio/reserva'
import { fechaLarga, formatoHora, instante, momentoDe, nombreDelDia } from '../../negocio/tiempo'
import { Pase } from '../../vista/Pase'
import { pagoDeMercadoPago, registrarAlVolver } from '../../mecanismos/pagos/alVolver'
import './mi-reserva.css'

export default function MiReserva() {
  const { token = '' } = useParams()
  const navegar = useNavigate()
  const [busqueda] = useSearchParams()
  const pago = busqueda.get('pago')
  const pagoId = pagoDeMercadoPago(busqueda)
  const { datos, cargando, error } = usarDatos(async () => {
    await registrarAlVolver(pagoId)
    return Promise.all([servicio.reservaPorTokenPrivado(token), servicio.configuracion()])
  }, [token, pagoId])
  const [accion, setAccion] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)

  if (error) return <p className="aviso aviso-error">{error}</p>
  if (!datos && cargando) return <p className="cargando">Cargando tu reserva…</p>
  const [r, config] = datos ?? [null, null]
  if (!r || !config) {
    return (
      <>
        <h1 className="titulo-grande" style={{ marginTop: 24 }}>
          No encontramos esa reserva
        </h1>
        <p className="nota">Revisa que el link esté completo. Si lo perdiste, en recepción te lo reenvían.</p>
        <div className="acciones">
          <Link className="boton boton-principal" to="/">
            Hacer una reserva
          </Link>
        </div>
      </>
    )
  }

  const d = config.deportes[r.deporte]
  const ahora = Date.now()
  const falta = pendiente(r)
  const miParte = r.partes.find((p) => p.delOrganizador && p.concepto === 'reserva')
  const linkCobro = direccion(`/c/${r.tokenCobro}`)
  const linkPrivado = direccion(`/r/${r.tokenPrivado}`)
  const cuando = `${fechaLarga(r.fecha)} a las ${formatoHora(r.inicio)}`
  const yaEmpezo = instante(r.fecha, r.inicio) <= ahora
  const enLinea = pagadoEnLinea(r)
  const recienPagada = pago === 'aprobado' && r.estado === 'confirmada'

  const ejecutar = async (nombre: string, f: () => Promise<unknown>) => {
    setAccion(nombre)
    setErrorAccion(null)
    try {
      await f()
    } catch (e) {
      setErrorAccion(mensajeDeError(e))
    } finally {
      setAccion(null)
    }
  }

  const pagarMiParte = () =>
    ejecutar('pagar', async () => {
      const { url } = await servicio.iniciarPago(r.tokenPrivado, [miParte!.id], r.organizador.nombre)
      if (url.startsWith('/')) navegar(url)
      else window.location.assign(url)
    })

  const cancelar = () => ejecutar('cancelar', () => servicio.cancelarComoCliente(r.tokenPrivado).then(() => setConfirmandoCancelar(false)))

  return (
    <>
      <h1 className="titulo-grande" style={{ marginTop: 20 }}>
        {recienPagada
  ? r.deporte === 'cornhole'
    ? '¡Listo! Ya tienen tablero'
    : '¡Listo! Ya tienen mesa'
  : 'Tu reserva'}
      </h1>
      {recienPagada && <p className="nota">Guarda este link: aquí ves quién ya pagó, compartes el cobro y puedes cancelar.</p>}
      {pago === 'cancelado' && r.estado === 'apartada' && (
        <p className="aviso aviso-alerta" role="alert">
          No se hizo el pago. Tu reserva sigue apartada unos minutos: puedes intentarlo otra vez.
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        <Pase
          config={config}
          datos={{
            deporteId: r.deporte,
            deporte: d.nombre,
            dia: nombreDelDia(r.fecha),
            inicio: r.inicio,
            duracion: r.duracion,
            titular: r.organizador.nombre,
            total: total(r),
            folio: r.folio,
            estado: textoDeEstado(r),
            apagado: r.estado === 'cancelada',
          }}
        />
      </div>

      <h2 className="titulo-seccion">Pagos</h2>
      <ListaDePagos r={r} />
      <p className="nota numeros">
        Pagado {formatoDinero(pagado(r))}
        {falta > 0 && r.estado !== 'cancelada' && ` · faltan ${formatoDinero(falta)}. Se pagan con el link o en el local; si no, los cubres tú.`}
      </p>

      {errorAccion && (
        <p className="aviso aviso-error" role="alert">
          {errorAccion}
        </p>
      )}

      {r.estado === 'confirmada' && (
        <div className="acciones">
          {r.partesElegidas > 1 && falta > 0 && (
            <a
              className="boton boton-principal"
              href={enlaceWhatsApp(`Ya aparté ${r.deporte === 'cornhole' ? 'el tablero' : 'la mesa'} de ${d.nombre} para el ${cuando} en Reta Saca. Aquí pagas tu parte: ${linkCobro}`)}
              target="_blank"
              rel="noreferrer"
            >
              Mandar el cobro a mis amigos
            </a>
          )}
          <a
            className="boton boton-secundario"
            href={enlaceWhatsApp(`Mi reserva en Reta Saca (${r.folio}), ${cuando}: ${linkPrivado}`, r.organizador.whatsapp)}
            target="_blank"
            rel="noreferrer"
          >
            Guardar mi link en WhatsApp
          </a>
          {config.whatsappNegocio && (
            <a
              className="boton boton-secundario"
              href={enlaceWhatsApp(`Hola, reservé ${d.nombre} para el ${cuando}. Folio ${r.folio}, a nombre de ${r.organizador.nombre}.`, config.whatsappNegocio)}
              target="_blank"
              rel="noreferrer"
            >
              Avisar al negocio
            </a>
          )}
        </div>
      )}

      {r.devolucion && <AvisoDeDevolucion r={r} whatsappNegocio={config.whatsappNegocio} cuando={cuando} deporte={d.nombre} />}

      {r.estado !== 'cancelada' && !yaEmpezo && (
        <div className="zona-cancelar">
          {!confirmandoCancelar ? (
            <button type="button" className="boton boton-texto" onClick={() => setConfirmandoCancelar(true)}>
              Cancelar reserva
            </button>
          ) : (
            <div className="grupo confirmar-cancelar">
              <p>
                {r.deporte === 'cornhole'
  ? 'El tablero se libera para alguien más.'
  : 'La mesa se libera para alguien más.'}
                {enLinea > 0 &&
                  ` Lo pagado en línea (${formatoDinero(enLinea)}) no se devuelve solo: el negocio revisa cada caso y, si procede, te lo transfiere.`}
              </p>
              <div className="confirmar-botones">
                <button type="button" className="boton boton-secundario" onClick={() => setConfirmandoCancelar(false)}>
                  Mejor no
                </button>
                <button type="button" className="boton boton-principal" disabled={accion !== null} onClick={cancelar}>
                  Sí, cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Link className="enlace-discreto" to="/">
        Hacer otra reserva
      </Link>

      {r.estado === 'apartada' && miParte && !miParte.pago && (
        <div className="barra-accion">
          <button type="button" className="boton boton-principal" disabled={accion !== null} onClick={pagarMiParte}>
            Pagar mi parte ({formatoDinero(miParte.monto)})
          </button>
        </div>
      )}
    </>
  )
}

function textoDeEstado(r: Reserva): string {
  if (r.estado === 'apartada') {
    const hasta = r.apartadaHasta ? new Date(r.apartadaHasta).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Hermosillo' }) : ''
    return `Apartada hasta ${hasta}`
  }
  if (r.estado === 'cancelada') {
    const motivo = { cliente: 'Cancelada', negocio: 'Cancelada por el local', no_llego: 'Liberada', apartado_vencido: 'No se pagó a tiempo' }
    return r.cancelacion ? motivo[r.cancelacion.motivo] : 'Cancelada'
  }
  return 'Confirmada'
}

/**
 * Qué pasa con lo pagado en línea de una cancelada. El sitio no pide ni guarda
 * datos bancarios: la CLABE va directo al WhatsApp del negocio.
 */
function AvisoDeDevolucion({ r, whatsappNegocio, cuando, deporte }: { r: Reserva; whatsappNegocio: string; cuando: string; deporte: string }) {
  const dv = r.devolucion!
  const monto = formatoDinero(dv.monto)
  if (dv.estado === 'transferida') {
    const dia = dv.en ? ` el ${fechaLarga(momentoDe(Date.parse(dv.en)).fecha)}` : ''
    return <p className="aviso aviso-alerta">El negocio te transfirió {monto}{dia}.</p>
  }
  if (dv.estado === 'sin_devolucion') return <p className="aviso aviso-alerta">El negocio revisó tu cancelación: no hay devolución.</p>
  return (
    <div className="grupo confirmar-cancelar">
      <p>
        Pagaron {monto} en línea. El negocio revisa tu cancelación y, si procede, te lo transfiere.{' '}
        {whatsappNegocio ? 'Mándale tu folio y tu CLABE:' : `Pídelo en recepción con tu folio ${r.folio}.`}
      </p>
      {whatsappNegocio && (
        <a
          className="boton boton-principal"
          href={enlaceWhatsApp(
            `Hola, cancelé mi reserva de ${deporte} del ${cuando}. Folio ${r.folio}, a nombre de ${r.organizador.nombre}; pagamos ${monto} en línea. Mi CLABE para la devolución es: `,
            whatsappNegocio,
          )}
          target="_blank"
          rel="noreferrer"
        >
          Pedir mi devolución por WhatsApp
        </a>
      )}
    </div>
  )
}

function ListaDePagos({ r }: { r: Reserva }) {
  let amigo = 1
  return (
    <ul className="grupo">
      {r.partes.map((p) => {
        const quien =
          p.concepto === 'extension' ? 'Tiempo extra' : p.concepto === 'cambio' ? 'Diferencia por cambio' : p.delOrganizador ? `${r.organizador.nombre} (tú)` : `Amigo ${amigo++}`
        const estado = !p.pago ? 'Pendiente' : p.pago.devuelto ? 'Devuelto' : `Pagó ${p.pago.nombre}`
        const pagada = Boolean(p.pago && !p.pago.devuelto)
        return (
          <li key={p.id} className="fila-pago">
            <span className="fila-pago-texto">
              <strong>{quien}</strong>
              <span className={pagada ? 'pagada' : ''}>{estado}</span>
            </span>
            <span className="numeros">{formatoDinero(p.monto)}</span>
          </li>
        )
      })}
    </ul>
  )
}
