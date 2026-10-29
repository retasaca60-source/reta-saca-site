// Aviso de privacidad. Los datos del responsable los dio el negocio el
// 28/10/2026. Tiene que decir lo que la página hace de verdad.
//
// Los proveedores que solo trabajan por encargo (hoy Supabase, Netlify y
// Sentry) van por su función y no por su nombre: la ley pide decir que existen
// y para qué, no quiénes son, y así cambiar de proveedor no obliga a cambiar el
// aviso. Clip sí se nombra porque el cliente le da su tarjeta directo y tiene
// su propio aviso. Si un proveedor nuevo usara los datos para SUS propios fines
// (una transferencia), o la página empezara a juntar otros datos sola
// (analítica, cookies de terceros), entonces sí se agrega aquí y se cambia la
// fecha.

import { Link } from 'react-router-dom'

export default function Privacidad() {
  return (
    <>
      <h1 className="titulo-grande" style={{ marginTop: 20 }}>
        Aviso de privacidad
      </h1>
      <div className="grupo texto-legal">
        <p>
          <strong>Hugo Castañeda Salazar</strong>, con domicilio en Rosa de Castilla Pte., C.P. 83224, Hermosillo, Sonora, es
          responsable del uso de los datos personales que nos das al reservar en Reta Saca.
        </p>
        <h3>Qué datos pedimos</h3>
        <ul>
          <li>De quien reserva: nombre y número de WhatsApp.</li>
          <li>
            Si la página falla mientras la usas: datos técnicos de ese momento (navegador, sistema del teléfono o computadora, dirección
            IP y la pantalla donde pasó), para encontrar y corregir el error.
          </li>
        </ul>
        <p>
          No pedimos ni guardamos datos de tarjeta: los pagos en línea los procesa Clip, con su propio aviso de privacidad.
        </p>
        <h3>Para qué los usamos</h3>
        <ul>
          <li>Registrar y administrar tu reserva: horario, pagos, cambios y cancelaciones.</li>
          <li>Comunicarnos contigo por WhatsApp sobre tu reserva.</li>
        </ul>
        <p>
          No usamos tus datos para publicidad ni los vendemos. Solo los manejan, por encargo nuestro, los proveedores que hacen
          funcionar la página: el que procesa los pagos (Clip), el que guarda las reservas, el que publica la página y el que nos
          avisa de errores.
        </p>
        <p>Guardamos los datos de cada reserva el tiempo necesario para atenderla y para las cuentas del negocio.</p>
        <h3>Tus derechos</h3>
        <p>
          Puedes pedir ver, corregir o borrar tus datos, u oponerte a su uso (derechos ARCO), escribiendo a <strong>retasaca60@gmail.com</strong> o al
          WhatsApp <strong>662 112 9285</strong>. Respondemos en un máximo de 20 días hábiles.
        </p>
        <h3>Cambios</h3>
        <p>Si este aviso cambia, lo publicaremos en esta misma página con la fecha de actualización.</p>
        <p className="nota-chica">Última actualización: 28 de octubre de 2026.</p>
      </div>
      <Link className="enlace-discreto" to="/">
        Volver
      </Link>
    </>
  )
}
