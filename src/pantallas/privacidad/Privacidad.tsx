// Aviso de privacidad. BORRADOR: faltan los datos del titular (RESERVAS.md →
// Pendientes de Hugo). Sin el aviso completo y revisado, no se cobra de verdad.

import { Link } from 'react-router-dom'

export default function Privacidad() {
  return (
    <>
      <h1 className="titulo-grande" style={{ marginTop: 20 }}>
        Aviso de privacidad
      </h1>
      <p className="aviso aviso-alerta">Borrador: falta el nombre legal, domicilio y contacto del responsable. Pendiente de Hugo.</p>
      <div className="grupo texto-legal">
        <p>
          <strong>[NOMBRE LEGAL DEL TITULAR]</strong>, con domicilio en <strong>[DOMICILIO DEL LOCAL]</strong>, es responsable del uso
          de los datos personales que nos das al reservar en Reta Saca.
        </p>
        <h3>Qué datos pedimos</h3>
        <ul>
          <li>De quien reserva: nombre y número de WhatsApp.</li>
          <li>De quien paga una parte con el link de cobro: solo su nombre.</li>
        </ul>
        <p>
          No pedimos ni guardamos datos de tarjeta: los pagos en línea los procesa Mercado Pago, con su propio aviso de privacidad.
        </p>
        <h3>Para qué los usamos</h3>
        <ul>
          <li>Registrar y administrar tu reserva: horario, pagos, cambios y cancelaciones.</li>
          <li>Comunicarnos contigo por WhatsApp sobre tu reserva.</li>
          <li>Saber quién pagó cada parte cuando el pago se divide.</li>
        </ul>
        <p>No usamos tus datos para publicidad ni los compartimos con terceros, salvo Mercado Pago para procesar el pago.</p>
        <h3>Tus derechos</h3>
        <p>
          Puedes pedir ver, corregir o borrar tus datos, u oponerte a su uso (derechos ARCO), escribiendo a <strong>[CORREO]</strong> o al
          WhatsApp <strong>[WHATSAPP DEL NEGOCIO]</strong>. Respondemos en un máximo de 20 días hábiles.
        </p>
        <h3>Cambios</h3>
        <p>Si este aviso cambia, lo publicaremos en esta misma página con la fecha de actualización.</p>
        <p className="nota-chica">Última actualización: [FECHA].</p>
      </div>
      <Link className="enlace-discreto" to="/">
        Volver
      </Link>
    </>
  )
}
