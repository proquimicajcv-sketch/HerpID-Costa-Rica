import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const CACHE_RESET_VERSION = '2026-08-04-v1'

async function limpiarCachesAntiguos() {
  if (typeof window === 'undefined') return

  const flag = `herpid_cache_reset_done_${CACHE_RESET_VERSION}`
  if (window.sessionStorage?.getItem(flag) === '1') return

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => null)))
    }

    if ('caches' in window && typeof caches.keys === 'function') {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))
    }
  } catch {
    // Si la limpieza falla, dejamos continuar el arranque de la app.
  } finally {
    try {
      window.sessionStorage?.setItem(flag, '1')
    } catch {
      // Ignorar errores de sessionStorage.
    }
  }
}

limpiarCachesAntiguos().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
