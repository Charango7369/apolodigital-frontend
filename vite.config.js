import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      // Excluir archivos de configuración del build
    }
  },
  publicDir: 'public', // asegúrate que wrangler.json no esté en /public
})