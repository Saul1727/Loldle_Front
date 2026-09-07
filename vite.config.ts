import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // sockjs-client (usado por el cliente STOMP del duelo en vivo) da por hecho que
  // existe "global", como en Node. En el navegador no existe: sin esto, la app
  // entera revienta al cargar con "ReferenceError: global is not defined".
  define: {
    global: "globalThis",
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})
