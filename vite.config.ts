/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La fecha de compilación queda en la página publicada (<meta name="compilacion">).
// Cuando alguien dice "no cambió nada", se abre el código fuente del sitio y se
// compara esa fecha con la del último despliegue: si es vieja, el navegador o
// Netlify está sirviendo una copia anterior, no es que el cambio no funcione.
const COMPILACION = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Hermosillo',
}).format(new Date())

export default defineConfig({
  server: { port: 5190 },
  plugins: [
    react(),
    {
      name: 'fecha-de-compilacion',
      transformIndexHtml: (html) =>
        html.replace('</head>', `  <meta name="compilacion" content="${COMPILACION}">\n  </head>`),
    },
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
