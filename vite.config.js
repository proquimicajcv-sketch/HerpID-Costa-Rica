import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawBasePath = env.VITE_BASE_PATH || '/'
  const basePath = rawBasePath === '/' ? '/' : rawBasePath.replace(/\/+$/, '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'icons.svg'],
        manifest: {
          name: 'HerpID Costa Rica',
          short_name: 'HerpID CR',
          description: 'Identificacion y reporte de herpetofauna en Costa Rica',
          theme_color: '#0b5a53',
          background_color: '#f2f7f4',
          display: 'standalone',
          start_url: basePath,
          scope: basePath,
          lang: 'es',
          icons: [
            {
              src: 'frog-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'frog-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'frog-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            mapas: ['leaflet', 'react-leaflet']
          }
        }
      }
    },
    base: basePath,
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      open: false,
      allowedHosts: true
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      open: false,
      allowedHosts: true
    }
  }
})