import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { es } from '../copy/es'

/** Estructura común: enlace para saltar al contenido, cabecera y un único landmark `main`. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a href="#contenido" className="skip-link">
        {es.common.skipToContent}
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            {es.appName}
          </Link>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
