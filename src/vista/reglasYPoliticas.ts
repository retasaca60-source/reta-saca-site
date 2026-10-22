// Las reglas de cada juego y las políticas de Reta Saca, tal como las entregó
// el negocio el 21/10/2026 (los PDF "REGLAMENTOS" y "POLÍTICAS"). Se muestran
// al terminar de reservar y en /politicas. Si el negocio cambia un texto, se
// cambia aquí y nada más.

import type { DeporteId } from '../negocio/configuracion'

export interface Regla {
  titulo: string
  texto: string
}

export const REGLAS_DEL_JUEGO: Record<DeporteId, Regla[]> = {
  pingpong: [
    { titulo: 'El objetivo', texto: 'Gana quien llegue primero a 11 puntos, con al menos 2 de ventaja.' },
    { titulo: 'Empate a 10', texto: 'Si van 10-10, sigan jugando hasta que alguien consiga 2 puntos de diferencia.' },
    { titulo: 'Saque correcto', texto: 'Pelota en la palma abierta; elévala al menos 16 cm, sin ocultarla, y golpea cuando baje.' },
    { titulo: 'Doble rebote en saque', texto: 'En el servicio, la pelota debe botar primero en tu lado y después en el del rival.' },
    { titulo: 'Cambio de saque', texto: 'Se alterna el servidor cada 2 puntos. Desde 10-10, se alterna cada punto.' },
    { titulo: 'Pelota en juego', texto: 'Devuelve la pelota a la mesa contraria antes del segundo bote; puede rozar la red.' },
    { titulo: 'Saque con red', texto: 'Si el servicio es correcto, pero toca la red al cruzar, el saque se repite.' },
    { titulo: '¿Cuándo pierdes el punto?', texto: 'Si fallas el saque, no devuelves, o la pelota bota dos veces en tu lado.' },
    { titulo: 'Red y mesa', texto: 'No toques la red, muevas la mesa ni apoyes tu mano libre sobre ella durante el punto.' },
    { titulo: 'En dobles', texto: 'Se saca en diagonal de derecha a derecha y se golpea en turnos alternos.' },
    { titulo: 'Partido y lados', texto: 'El partido se juega al mejor de un número impar de juegos; cambia de lado entre juegos.' },
  ],
  cornhole: [
    { titulo: 'Participantes', texto: 'Se juega 1 vs. 1 o 2 vs. 2. En parejas, un integrante se coloca en cada extremo.' },
    { titulo: 'Distancia oficial', texto: 'Los dos tableros van a 27 pies (8.23 m) entre sus bordes delanteros.' },
    { titulo: 'Bolsas por equipo', texto: 'Cada jugador o equipo dispone de 4 bolsas: 8 lanzamientos por ronda entre rivales.' },
    { titulo: 'Quién empieza', texto: 'Se decide por sorteo. Después, inicia la ronda el equipo que anotó en la anterior.' },
    { titulo: 'Lanzamiento por turnos', texto: 'Cada rival lanza una bolsa por vez y esperan a que la anterior se detenga.' },
    { titulo: 'No pises la línea', texto: 'Lanza desde el área lateral del tablero; no pises o cruces la línea de falta.' },
    { titulo: 'Bolsa en el hoyo', texto: 'Una bolsa que atraviesa completamente el hoyo vale 3 puntos.' },
    { titulo: '¿Bolsa en el tablero?', texto: 'Una bolsa apoyada sobre el tablero (incluso colgando en el hoyo) vale 1 punto.' },
    { titulo: 'Bolsa fuera', texto: 'Si cae fuera o toca el suelo antes de llegar al tablero, vale 0 puntos.' },
    { titulo: 'Puntos por cancelación', texto: 'Al terminar la ronda, resta ambos puntajes: si A hace 8 y B hace 5, A suma 3.' },
    { titulo: 'Cómo se gana', texto: 'Gana el primer equipo que llega a 21 puntos o más al finalizar una ronda.' },
  ],
}

export const POLITICAS: Regla[] = [
  { titulo: 'Puntualidad', texto: 'El tiempo reservado comienza a la hora acordada, aunque los jugadores lleguen tarde.' },
  {
    titulo: 'Cambios, cancelaciones y reembolsos',
    texto:
      'Los cambios o cancelaciones se deberán de solicitar con al menos 24 horas de anticipación, vía WhatsApp o Instagram. Los reembolsos autorizados se realizarán mediante el método de pago original, salvo que el cliente acepte recibirlos en efectivo en el establecimiento.',
  },
  {
    titulo: 'Pago en página web y local',
    texto:
      'Se pagará la totalidad del monto de la reserva a través de la página web para poder reservar. El pago en el local se realizará a través de la terminal o en efectivo.',
  },
  {
    titulo: 'Interrupciones y clima',
    texto:
      'Si un evento climático o una falla del negocio impide continuar el juego y se jugó menos del 70% del tiempo establecido, se dará tiempo extra en otro horario por definir, con base en un análisis individual de cada caso.',
  },
  { titulo: 'Extensión de tiempo', texto: 'Solo se puede agregar tiempo extra si hay disponibilidad en la agenda.' },
  { titulo: 'Horario y desempate', texto: 'Una vez cumplido el horario, se juega a un punto de oro si el juego lo requiere.' },
  { titulo: 'Cierre del establecimiento', texto: 'Los juegos deben finalizar dentro del horario de operación, salvo autorización del personal.' },
  { titulo: 'Promociones', texto: 'Las promociones y descuentos no son acumulables ni canjeables por efectivo.' },
  { titulo: 'Cargos adicionales', texto: 'Todo servicio extra o cargo por reposición deberá informarse antes de cobrarse.' },
  { titulo: 'Número de jugadores', texto: 'Cada juego tiene un límite de participantes según la modalidad contratada.' },
  {
    titulo: 'Daños por mal uso',
    texto:
      'Está prohibido golpear deliberadamente o maltratar el equipo y el mobiliario. Los daños causados por mal uso podrán generar un cargo por el costo comprobable de reparación o reposición, previa evaluación e información al cliente.',
  },
  { titulo: 'Suspensión por seguridad', texto: 'El personal podrá detener temporalmente una partida cuando exista riesgo.' },
  { titulo: 'Estado inconveniente', texto: 'Se podrá negar o suspender el juego si una persona representa un riesgo evidente.' },
  { titulo: 'Indicaciones del personal', texto: 'Los jugadores deberán atender las indicaciones del personal.' },
  { titulo: 'Seguridad entre mesas', texto: 'Está prohibido correr o invadir las áreas de juego de otros clientes.' },
  { titulo: 'Accidentes', texto: 'Cualquier lesión o incidente deberá reportarse de inmediato al personal.' },
  { titulo: 'Menores de edad', texto: 'Los menores deben permanecer bajo la supervisión de un adulto responsable.' },
  { titulo: 'No comer', texto: 'Está prohibido comer mientras haya un juego en curso.' },
  { titulo: 'Sin bebidas en las mesas', texto: 'No se permite colocar vasos ni botellas sobre las superficies de juego.' },
  { titulo: 'Zona de lanzamiento', texto: 'En cornhole, los tiros deben realizarse desde la zona marcada.' },
  { titulo: 'Uso adecuado del equipo', texto: 'Palas, pelotas, bolsas y tableros deben utilizarse solo para jugar.' },
  { titulo: 'No mover el mobiliario', texto: 'No está permitido mover mesas, tableros u otros elementos sin autorización.' },
  { titulo: 'No sentarse', texto: 'Está prohibido sentarse, pararse o recargarse con fuerza sobre el mobiliario.' },
  { titulo: 'Daños preexistentes', texto: 'Cualquier desperfecto debe reportarse al personal antes de comenzar.' },
  { titulo: 'Entrega de equipo', texto: 'Debe entregarse la misma cantidad de palas, pelotas y bolsas recibidas.' },
  { titulo: 'Pérdida de material', texto: 'Los artículos extraviados por el cliente podrán generar cargo de reposición.' },
  { titulo: 'Material defectuoso', texto: 'El personal reemplazará el equipo que deje de ser apto por desgaste normal.' },
  { titulo: 'Objetos ajenos', texto: 'No se permite usar objetos ajenos al juego que puedan dañar el equipo.' },
  { titulo: 'Devolución de pelotas', texto: 'Se devuelven todas las pelotas, aun estando rotas.' },
  { titulo: 'Cambio de jugadores', texto: 'Se permiten sustituciones durante la partida si no se excede el máximo contratado.' },
  {
    titulo: 'Tiempos de reservación',
    texto:
      'Las reservas a través de la página web serán mediante los horarios establecidos. En el local las reservas comienzan a partir de que el cliente realice como mínimo la mitad del pago del juego.',
  },
  {
    titulo: 'Reto Kobe',
    texto:
      'Para lograr el objetivo, el jugador tendrá que tirar, desde el área marcada para este juego, los 3 sacos de cornhole, encestándolos de manera consecutiva y contará con 30 segundos para hacerlo.',
  },
]
