// Lo que el negocio cobra, escrito como pruebas. Si alguien cambia una regla
// sin querer, `npm test` lo dice antes de que llegue al sitio. Si el cambio SÍ
// es a propósito (sube un precio), se actualiza la prueba junto con catalogo.ts.

import { describe, expect, it } from 'vitest'
import { avisoPocosLugares, horasQueCaben, mesasOcupadas } from './disponibilidad'
import { anticipoPara, esHorarioPromo, precioDeLista, precioPara, sePagaTodoAlReservar } from './precios'

describe('precio de lista en la tarjeta', () => {
  it('Ping Pong y Popdarts anuncian el precio de 2 personas; Cornhole, el de 4', () => {
    expect(precioDeLista('pingpong')).toBe(150)
    expect(precioDeLista('cornhole')).toBe(300)
    expect(precioDeLista('popdarts')).toBe(120)
  })
})

describe('promo', () => {
  it('entre semana es solo a las 5 PM', () => {
    expect(esHorarioPromo('pingpong', false, 17, 60)).toBe(true)
    expect(esHorarioPromo('pingpong', false, 18, 60)).toBe(false)
  })
  it('en domingo es todo el día', () => {
    expect(esHorarioPromo('cornhole', true, 21, 60)).toBe(true)
  })
  it('solo aplica a reservas de 60 minutos', () => {
    expect(esHorarioPromo('pingpong', true, 17, 30)).toBe(false)
    expect(esHorarioPromo('cornhole', false, 17, 90)).toBe(false)
  })
  it('Popdarts nunca tiene promo', () => {
    expect(esHorarioPromo('popdarts', true, 17, 60)).toBe(false)
  })
})

describe('precio', () => {
  it('Ping Pong: 4 personas cuesta $50 más', () => {
    expect(precioPara('pingpong', 2, 60, false)).toBe(150)
    expect(precioPara('pingpong', 4, 60, false)).toBe(200)
  })
  it('con promo baja', () => {
    expect(precioPara('pingpong', 2, 60, true)).toBe(120)
    expect(precioPara('cornhole', 4, 60, true)).toBe(240)
  })
  it('Popdarts cuesta igual con 2 o 4', () => {
    expect(precioPara('popdarts', 2, 90, false)).toBe(175)
    expect(precioPara('popdarts', 4, 90, false)).toBe(175)
  })
})

describe('qué se paga al reservar', () => {
  it('Ping Pong de 30 o 60 min se paga completo', () => {
    expect(sePagaTodoAlReservar('pingpong', 60)).toBe(true)
    expect(anticipoPara('pingpong', 60, 150)).toBe(150)
  })
  it('Ping Pong de 90 min deja anticipo de $110', () => {
    expect(anticipoPara('pingpong', 90, 220)).toBe(110)
  })
  it('Cornhole siempre es anticipo', () => {
    expect(sePagaTodoAlReservar('cornhole', 60)).toBe(false)
    expect(anticipoPara('cornhole', 60, 300)).toBe(75)
    expect(anticipoPara('cornhole', 120, 560)).toBe(140)
  })
  it('Popdarts siempre se paga completo', () => {
    expect(anticipoPara('popdarts', 120, 230)).toBe(230)
  })
})

describe('disponibilidad', () => {
  it('no se ofrece una hora que termine después de las 11 PM', () => {
    expect(horasQueCaben(60)).toEqual([17, 18, 19, 20, 21, 22])
    expect(horasQueCaben(90)).toEqual([17, 18, 19, 20, 21])
    expect(horasQueCaben(120)).toEqual([17, 18, 19, 20, 21])
  })
  it('avisa "quedan pocos" con 3 o menos en Ping Pong y Cornhole, y con 1 en Popdarts', () => {
    expect(avisoPocosLugares('pingpong', 4)).toBeNull()
    expect(avisoPocosLugares('pingpong', 3)).toBe('Quedan 3 disponibles')
    expect(avisoPocosLugares('cornhole', 1)).toBe('Queda 1 disponible')
    expect(avisoPocosLugares('popdarts', 2)).toBeNull()
    expect(avisoPocosLugares('popdarts', 1)).toBe('Queda 1 disponible')
    expect(avisoPocosLugares('pingpong', 0)).toBeNull()
  })
  it('la ocupación de ejemplo es siempre la misma para la misma combinación', () => {
    expect(mesasOcupadas('pingpong', 3, 19)).toBe(mesasOcupadas('pingpong', 3, 19))
    for (const h of [17, 18, 19, 20, 21, 22]) {
      const n = mesasOcupadas('cornhole', 0, h)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(8)
    }
  })
})
