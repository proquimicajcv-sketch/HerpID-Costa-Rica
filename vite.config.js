import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function localApiDevPlugin() {
  const rootDir = process.cwd()
  const apiDir = path.resolve(rootDir, 'api')

  const resolveApiFile = (requestUrl) => {
    const pathname = String(requestUrl || '').split('?')[0]
    if (!pathname.startsWith('/api/')) return null

    const relativePath = pathname.replace(/^\/+/, '')
    const filePath = path.resolve(rootDir, `${relativePath}.js`)
    if (!filePath.startsWith(apiDir) || !fs.existsSync(filePath)) {
      return null
    }

    return filePath
  }

  const readJsonBody = async (req) => {
    const method = String(req.method || 'GET').toUpperCase()
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return undefined
    }

    const chunks = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    if (!chunks.length) return undefined
    const rawBody = Buffer.concat(chunks).toString('utf8')
    if (!rawBody) return undefined

    const contentType = String(req.headers['content-type'] || '').toLowerCase()
    if (contentType.includes('application/json')) {
      return JSON.parse(rawBody)
    }

    return rawBody
  }

  const decorateResponse = (res) => {
    if (typeof res.status !== 'function') {
      res.status = (code) => {
        res.statusCode = code
        return res
      }
    }

    if (typeof res.send !== 'function') {
      res.send = (payload) => {
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        }
        res.end(payload)
        return res
      }
    }

    return res
  }

  return {
    name: 'local-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const filePath = resolveApiFile(req.url)
        if (!filePath) {
          next()
          return
        }

        try {
          req.body = await readJsonBody(req)
          decorateResponse(res)

          const moduleUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`
          const mod = await import(moduleUrl)
          const handler = mod?.default

          if (typeof handler !== 'function') {
            res.status(500).setHeader('Content-Type', 'application/json')
            res.send(JSON.stringify({ error: 'Handler de API inválido.' }))
            return
          }

          await handler(req, res)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error interno del servidor de desarrollo.'
          decorateResponse(res)
          res.status(500).setHeader('Content-Type', 'application/json')
          res.send(JSON.stringify({ error: message }))
        }
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  const isVercel = String(process.env.VERCEL || '') === '1'
  const rawBasePath = isVercel ? '/' : (env.VITE_BASE_PATH || '/')
  const basePath = rawBasePath === '/' ? '/' : rawBasePath.replace(/\/+$/, '')
  const pwaPlugin = VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    includeAssets: ['favicon.svg', 'icons.svg'],
    workbox: {
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true
    },
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

  return {
    plugins: [
      react(),
      localApiDevPlugin(),
      ...(!isVercel ? [pwaPlugin] : [])
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