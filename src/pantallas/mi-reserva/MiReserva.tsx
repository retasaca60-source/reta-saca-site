// El link privado del organizador (/r/<token>): su ticket, lo pagado y las
// reglas. Es también la confirmación al pagar ("¡Listo, ya se armó la reta!").
// Desde el 21/10/2026 no se cancela desde aquí: los cambios y cancelaciones se
// piden con 24 h de anticipación por WhatsApp o Instagram (política 02).
// Sin cuenta: quien tiene este link ve su reserva (RESERVAS.md §6).

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { servicio } from '../../datos'
import { mensajeDeError, usarDatos } from '../../mecanismos/datos/usarDatos'
import { direccion, enlaceWhatsApp } from '../../mecanismos/whatsapp/enlaces'
import { formatoDinero } from '../../negocio/formato'
import { pagado, pendiente, total, type Reserva } from '../../negocio/reserva'
import { fechaLarga, formatoHora, momentoDe, nombreDelDia } from '../../negocio/tiempo'
import { Pase } from '../../vista/Pase'
import { Politicas, ReglasDelJuego } from '../../vista/Reglamento'
import { intentoAlVolver, registrarAlVolver } from '../../mecanismos/pagos/alVolver'
import './mi-reserva.css'

export default function MiReserva() {
  const { token = '' } = useParams()
  const navegar = useNavigate()
  const [busqueda] = useSearchParams()
  const pago = busqueda.get('pago')
  const intentoId = intentoAlVolver(busqueda)
  const { datos, cargando, error } = usarDatos(async () => {
    await registrarAlVolver(intentoId)
    return Promise.all([servicio.reservaPorTokenPrivado(token), servicio.configuracion()])
  }, [token, intentoId])
  const [accion, setAccion] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

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
  const falta = pendiente(r)
  const miParte = r.partes.find((p) => p.delOrganizador && p.concepto === 'reserva')
  const linkPrivado = direccion(`/r/${r.tokenPrivado}`)
  const cuando = `${fechaLarga(r.fecha)} a las ${formatoHora(r.inicio)}`
  // La URL sola no basta (cualquiera puede escribir ?pago=aprobado): además
  // la parte del organizador tiene que estar pagada en los datos.
  const recienPagada = pago === 'aprobado' && r.estado === 'confirmada' && Boolean(miParte?.pago)

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

  const pagar = () =>
    ejecutar('pagar', async () => {
      const { url } = await servicio.iniciarPago(r.tokenPrivado, [miParte!.id], r.organizador.nombre)
      if (url.startsWith('/')) navegar(url)
      else window.location.assign(url)
    })

  return (
    <>
      <h1 className="titulo-grande" style={{ marginTop: 20 }}>
        {recienPagada ? '¡Listo, ya se armó la reta!' : 'Tu reserva'}
      </h1>
      {recienPagada && <p className="nota">Guarda este link: aquí está tu ticket y las reglas.</p>}
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
            deporte: r.modalidad === 'pareja' ? `${d.nombre} · 2 personas` : d.nombre,
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

      {r.palasExtra ? <p className="nota">Incluye 2 palas extra ({formatoDinero(r.palasExtra)}).</p> : null}

      <h2 className="titulo-seccion">Pagos</h2>
      <ListaDePagos r={r} />
      <p className="nota numeros">
        Pagado {formatoDinero(pagado(r))}
        {falta > 0 && r.estado !== 'cancelada' && ` · faltan ${formatoDinero(falta)}, se pagan en el local.`}
      </p>

      {errorAccion && (
        <p className="aviso aviso-error" role="alert">
          {errorAccion}
        </p>
      )}

      {r.estado === 'confirmada' && (
        <div className="acciones">
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

      {r.estado !== 'cancelada' && (
        <p className="nota">
          ¿Cambios o cancelaciones? Pídelos con al menos 24 horas de anticipación por WhatsApp o Instagram.
        </p>
      )}

      {/* Al terminar de reservar: las reglas del juego a la vista y las
          políticas plegadas, que son largas. */}
      {r.estado === 'confirmada' && (
        <>
          <ReglasDelJuego deporte={r.deporte} nombre={d.nombre} />
          <Politicas plegadas />
        </>
      )}

      <Link className="enlace-discreto" to="/">
        Hacer otra reserva
      </Link>

      {r.estado === 'apartada' && miParte && !miParte.pago && (
        <div className="barra-accion">
          <button type="button" className="boton boton-principal" disabled={accion !== null} onClick={pagar}>
            Pagar ({formatoDinero(miParte.monto)})
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
 * Qué pasa con lo pagado en línea de una cancelada. Los reembolsos autorizados
 * se hacen por el método de pago original o en efectivo en el local (política
 * 02): el sitio no pide datos bancarios.
 */
function AvisoDeDevolucion({ r, whatsappNegocio, cuando, deporte }: { r: Reserva; whatsappNegocio: string; cuando: string; deporte: string }) {
  const dv = r.devolucion!
  const monto = formatoDinero(dv.monto)
  if (dv.estado === 'transferida') {
    const dia = dv.en ? ` el ${fechaLarga(momentoDe(Date.parse(dv.en)).fecha)}` : ''
    return <p className="aviso aviso-alerta">El negocio te reembolsó {monto}{dia}.</p>
  }
  if (dv.estado === 'sin_devolucion') return <p className="aviso aviso-alerta">El negocio revisó tu cancelación: no hay devolución.</p>
  return (
    <div className="grupo confirmar-cancelar">
      <p>
        Pagaron {monto} en línea. El negocio revisa tu cancelación y, si procede, te lo reembolsa por el mismo medio de pago o en
        efectivo en el local.{' '}
        {whatsappNegocio ? 'Escríbele con tu folio:' : `Pregunta en recepción con tu folio ${r.folio}.`}
      </p>
      {whatsappNegocio && (
        <a
          className="boton boton-principal"
          href={enlaceWhatsApp(
            `Hola, mi reserva de ${deporte} del ${cuando} se canceló. Folio ${r.folio}, a nombre de ${r.organizador.nombre}; pagamos ${monto} en línea. ¿Cómo queda mi reembolso?`,
            whatsappNegocio,
          )}
          target="_blank"
          rel="noreferrer"
        >
          Preguntar por mi reembolso
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
