// Recorrido completo del flujo de reserva, para comparar dos versiones.
//
// PARA QUÉ: cuando un cambio NO debería alterar lo que ve el cliente (reordenar
// código, separar archivos, cambiar estilos internos), esto lo demuestra. Pasa
// por cada deporte, cada opción de jugadores, los días visibles, cada duración y
// cada horario, entra al resumen de pago de cada uno, y al final da una "huella"
// de todo lo que se vio. Misma huella antes y después = mismo comportamiento.
//
// CÓMO:
//   1. `npm run dev` y abrir http://localhost:5190 en el navegador.
//   2. Abrir la consola del navegador (F12 → Console).
//   3. Pegar TODO este archivo y Enter. Tarda unos segundos.
//   4. Anotar `huella`. Hacer el cambio, recargar la página y repetir.
//   5. Si las huellas difieren, `window.__recorrido` trae todo el detalle para
//      buscar dónde (por ejemplo, `window.__recorrido.combinaciones[12]`).
//
// OJO: correr las dos versiones el MISMO día, porque los días visibles salen de
// la fecha de hoy. Si el cambio SÍ altera algo a propósito (un precio nuevo),
// la huella cambia y eso es lo esperado: revisar que cambie solo lo que debía.
//
// Solo usa clases CSS y textos de pantalla (.sport-tile, .chip, .slot, …). Si
// esas clases cambian de nombre, hay que ajustar este archivo.

(async () => {
  // MessageChannel y no setTimeout: si la pestaña queda en segundo plano, el
  // navegador frena setTimeout a 1 por segundo y el recorrido tardaría horas.
  const canal = new MessageChannel()
  let pendiente = null
  canal.port1.onmessage = () => { const p = pendiente; pendiente = null; p && p() }
  const espera = () => new Promise((r) => { pendiente = r; canal.port2.postMessage(0) })
  const $ = (s) => document.querySelector(s)
  const $$ = (s) => [...document.querySelectorAll(s)]
  const txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null)
  const clic = async (e) => { e.click(); await espera() }
  const escribir = async (input, valor) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await espera()
  }
  const out = { deportes: [], combinaciones: [], errores: [] }
  const progreso = () => $$('.progress-labels span').map((s) => txt(s) + (s.classList.contains('current') ? '*' : '')).join('|')

  out.inicio = { progreso: progreso(), botonDeshabilitado: $('.nav-row .btn-primary').disabled }
  const nDeportes = $$('.sport-tile').length
  for (let s = 0; s < nDeportes; s++) {
    await clic($$('.sport-tile')[s])
    const tile = $$('.sport-tile')[s]
    out.deportes.push({
      nombre: txt(tile.querySelector('.sport-name')), meta: txt(tile.querySelector('.sport-meta')),
      precio: txt(tile.querySelector('.sport-price')), seleccionado: tile.classList.contains('selected'),
      pista: txt($$('.card')[1]?.querySelector('.section-hint')),
      chips: $$('.chip').map((c) => txt(c) + (c.querySelector('.badge') ? '+rec' : '')),
      continuarHabilitado: !$('.nav-row .btn-primary').disabled,
    })
    const nPersonas = $$('.chip').length
    for (let p = 0; p < nPersonas; p++) {
      await clic($$('.sport-tile')[s])
      await clic($$('.chip')[p])
      await clic($('.nav-row .btn-primary'))
      const cabecera = txt($$('.card')[0].querySelector('.section-hint'))
      for (let f = 0; f < $$('.date-chip').length; f++) {
        await clic($$('.date-chip')[f])
        const fecha = txt($$('.date-chip')[f]) + ($$('.date-chip')[f].querySelector('.sun-dot') ? '(dom)' : '')
        for (let d = 0; d < $$('.chip-row .chip').length; d++) {
          await clic($$('.chip-row .chip')[d])
          const dur = txt($$('.chip-row .chip')[d])
          const promo = txt($('.promo-strip'))
          const slots = $$('.slot').map((b) => [txt(b.querySelector('.t')), txt(b.querySelector('.p')), txt(b.querySelector('.low')), b.classList.contains('full') ? 'lleno' : '', b.classList.contains('promo') ? 'promo' : '', b.disabled ? 'dis' : ''].join('/'))
          const resumenes = []
          for (let h = 0; h < $$('.slot').length; h++) {
            const b = $$('.slot')[h]
            if (b.disabled) continue
            await clic(b)
            await clic($('.nav-row .btn-primary'))
            resumenes.push({
              filas: $$('.summary-row').map((r) => txt(r)),
              total: txt($('.summary-total')),
              reparto: $$('.split-box').map((x) => txt(x)),
            })
            await clic($('.nav-row .btn-ghost'))
          }
          out.combinaciones.push({ deporte: s, personas: p, cabecera, fecha, dur, promo, slots, resumenes })
        }
      }
      await clic($('.nav-row .btn-ghost'))
    }
  }

  // Paso 3 con datos, validación y pantalla final.
  await clic($$('.sport-tile')[0]); await clic($$('.chip')[0]); await clic($('.nav-row .btn-primary'))
  await clic($$('.slot:not(.full)')[0]); await clic($('.nav-row .btn-primary'))
  const confirmar = () => $('.nav-row .btn-primary')
  const inputs = $$('input')
  const validacion = { vacio: confirmar().disabled }
  await escribir(inputs[0], 'Ana')
  await escribir(inputs[1], '66a2-12')
  validacion.waLimpio = inputs[1].value
  validacion.errorCorto = txt($('.error-text'))
  validacion.corto = confirmar().disabled
  await escribir(inputs[1], '662123456799')
  validacion.waRecortado = inputs[1].value
  validacion.errorCompleto = txt($('.error-text'))
  validacion.completo = confirmar().disabled
  await clic(confirmar())
  validacion.final = {
    titulo: txt($('.success-title')), pista: txt($('.success-wrap .section-hint')),
    codigo: /^RS-[A-Z0-9]{5}$/.test(txt($('.code-box'))),
    filas: $$('.summary-row').map((r) => txt(r).replace(/PP \d/, 'PP #')),
    whatsapp: txt($$('.success-wrap .section-hint')[1]),
    progreso: progreso(),
  }
  await clic($('.success-wrap .btn-primary'))
  validacion.reinicio = { progreso: progreso(), seleccionados: $$('.selected').length }
  out.validacion = validacion

  const json = JSON.stringify(out)
  let h = 0; for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) >>> 0
  window.__recorrido = out
  return { huella: h.toString(16), combinaciones: out.combinaciones.length, resumenes: out.combinaciones.reduce((n, c) => n + c.resumenes.length, 0), bytes: json.length }
})()
