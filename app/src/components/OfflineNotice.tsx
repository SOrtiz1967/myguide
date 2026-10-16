import { useSyncExternalStore } from 'react'
import { es } from '../copy/es'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Aviso persistente mientras no hay conexión (FR-020). No ofrece ninguna función offline. */
export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  if (online) return null

  return (
    <p role="alert" className="border-b border-danger/40 bg-danger/10 px-4 py-3 text-center">
      {es.offline.banner}
    </p>
  )
}
