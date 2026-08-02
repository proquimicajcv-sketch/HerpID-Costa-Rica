import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawBasePath = env.VITE_BASE_PATH || '/'
  const basePath = rawBasePath === '/' ? '/' : rawBasePath.replace(/\/+$/, '')

  return {
    plugins: [
      react()
    ],
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