// Los usuarios del panel son nombres cortos ("recepcion", "hugo"), no correos:
// el panel solo se usa en el local y nadie necesita recibir correos.
//
// Supabase Auth solo entra con correo, así que cada usuario se guarda por dentro
// como una dirección que nadie ve: <usuario>@panel.retasaca.com. Es un
// subdominio del negocio (no de otra persona) y NUNCA se le manda correo: las
// cuentas las crea el dueño desde el panel con su contraseña, ya confirmadas.
// Lo usan el navegador (al entrar) y el servidor (al crear cuentas).

export const DOMINIO_USUARIOS = 'panel.retasaca.com'

export const normalizarUsuario = (usuario: string) => usuario.trim().toLowerCase()

/** De 3 a 30: letras minúsculas, números, punto, guion o guion bajo; empieza con letra o número. */
export const usuarioValido = (usuario: string) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(usuario)

export const correoInterno = (usuario: string) => `${normalizarUsuario(usuario)}@${DOMINIO_USUARIOS}`

/** Mínimo de la contraseña de una cuenta del panel. */
export const MINIMO_CONTRASENA = 8
