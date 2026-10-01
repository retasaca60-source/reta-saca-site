// Los errores esperados de una operación: el mensaje es para la persona
// (cliente o recepción) y la pantalla lo muestra tal cual.

export type CodigoDeError =
  | 'sin_lugar' // ya no hay mesa en ese horario
  | 'fuera_de_horario' // cerrado, fuera de la ventana de 7 días o pasado el corte
  | 'demasiados_intentos' // la misma dirección o el mismo WhatsApp apartó demasiado sin pagar
  | 'datos_invalidos'
  | 'no_encontrada'
  | 'no_permitido' // p. ej. cancelar con devolución fuera de plazo, o recepción editando precios
  | 'apartado_vencido' // se tardó más de 10 min en pagar y la mesa ya no está
  | 'sin_sesion'

/** Todos los errores esperados del servicio son de este tipo: la pantalla muestra `message`. */
export class ErrorDeDatos extends Error {
  readonly codigo: CodigoDeError
  constructor(codigo: CodigoDeError, mensaje: string) {
    super(mensaje)
    this.codigo = codigo
    this.name = 'ErrorDeDatos'
  }
}
