import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000, // Cambiado de 5173 a 3000 para forzar un nuevo túnel
    strictPort: true
  }
})