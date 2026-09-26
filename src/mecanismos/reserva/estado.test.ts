// Los tres errores que traía la versión original, escritos como pruebas para
// que no regresen.

import { describe, expect, it } from 'vitest'
import { DEPORTES, DIAS_VISIBLES, HORAS_DE_INICIO } from '../../negocio/catalogo'
import { folioDeReserva, mesaLibre, mesasOcupadas } from '../../negocio/disponibilidad'
import { reducir, reservaNueva, type Accion, type Reserva } from './estado'

const aplicar = (acciones: Accion[], desde: Reserva = reservaNueva) => acciones.reduce(reducir, desde)

/** Un día y una hora en que Ping Pong tiene lugar y Cornhole está lleno. */
function pingPongLibreCornholeLleno() {
  for (let dia = 0; dia < DIAS_VISIBLES; dia++) {
    for (const hora of HORAS_DE_INICIO) {
      const ppLibre = mesasOcupadas('pingpong', dia, hora) < DEPORTES.pingpong.mesas
      const chLleno = mesasOcupadas('cornhole', dia, hora) >= DEPORTES.cornhole.mesas
      if (ppLibre && chLleno) return { dia, hora }
    }
  }
  throw new Error('La ocupación de ejemplo no tiene el caso; la prueba necesita otro')
}

describe('1. no se puede reservar una hora llena', () => {
  const { dia, hora } = pingPongLibreCornholeLleno()
  const conHoraDePingPong = aplicar([
    { tipo: 'elegirDeporte', deporte: 'pingpong' },
    { tipo: 'elegirPersonas', personas: 2 },
    { tipo: 'irAPaso', paso: 2 },
    { tipo: 'elegirDia', dia },
    { tipo: 'elegirHora', hora },
    { tipo: 'irAPaso', paso: 1 },
  ])

  it('al cambiar a un deporte que a esa hora está lleno, la hora se suelta', () => {
    const r = aplicar([
      { tipo: 'elegirDeporte', deporte: 'cornhole' },
      { tipo: 'elegirPersonas', personas: 4 },
      { tipo: 'irAPaso', paso: 2 },
    ], conHoraDePingPong)
    expect(r.paso).toBe(2)
    expect(r.hora).toBeNull()
  })

  it('y aunque una pantalla lo intentara, no pasa a Datos', () => {
    const forzada = { ...conHoraDePingPong, deporte: 'cornhole' as const, personas: 4 as const, paso: 2 as const }
    expect(reducir(forzada, { tipo: 'irAPaso', paso: 3 }).paso).toBe(2)
  })

  it('si la hora sigue libre, se conserva al volver', () => {
    const r = aplicar([{ tipo: 'elegirPersonas', personas: 2 }, { tipo: 'irAPaso', paso: 2 }], {
      ...conHoraDePingPong,
      personas: null,
    })
    expect(r.hora).toBe(hora)
  })

  it('una hora que ya no cabe antes del cierre también se suelta', () => {
    // 10 PM con 60 min cabe; al volver con 90 min (terminaría 11:30 PM), no.
    const r = aplicar([
      { tipo: 'elegirDeporte', deporte: 'popdarts' },
      { tipo: 'irAPaso', paso: 2 },
      { tipo: 'elegirHora', hora: 22 },
    ])
    const conNoventa = { ...r, duracion: 90 as const, paso: 1 as const }
    expect(reducir(conNoventa, { tipo: 'irAPaso', paso: 2 }).hora).toBeNull()
  })
})

describe('2. Popdarts respeta cuántos jugadores se eligen', () => {
  it('empieza en 2 sin tener que tocar nada', () => {
    expect(aplicar([{ tipo: 'elegirDeporte', deporte: 'popdarts' }]).personas).toBe(2)
  })
  it('y si se eligen 4, quedan 4', () => {
    const r = aplicar([
      { tipo: 'elegirDeporte', deporte: 'popdarts' },
      { tipo: 'elegirPersonas', personas: 4 },
    ])
    expect(r.personas).toBe(4)
  })
})

describe('3. mesa y folio', () => {
  it('la mesa asignada nunca es una de las ocupadas', () => {
    for (const id of ['pingpong', 'cornhole', 'popdarts'] as const) {
      for (let dia = 0; dia < DIAS_VISIBLES; dia++) {
        for (const hora of HORAS_DE_INICIO) {
          const ocupadas = mesasOcupadas(id, dia, hora)
          if (ocupadas >= DEPORTES[id].mesas) {
            expect(() => mesaLibre(id, dia, hora)).toThrow()
            continue
          }
          for (let vez = 0; vez < 20; vez++) {
            const n = Number(mesaLibre(id, dia, hora).split(' ')[1])
            expect(n).toBeGreaterThan(ocupadas)
            expect(n).toBeLessThanOrEqual(DEPORTES[id].mesas)
          }
        }
      }
    }
  })

  it('el folio siempre trae 5 caracteres y ninguno que se confunda (0, O, 1, I, L)', () => {
    for (let vez = 0; vez < 2000; vez++) {
      expect(folioDeReserva()).toMatch(/^RS-[2-9A-HJKMNP-Z]{5}$/)
    }
  })
})
