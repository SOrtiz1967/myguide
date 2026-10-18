import { useContext, type ReactNode } from 'react'
import { Link } from 'react-router'
import { es } from '../copy/es'
import { AuthContext } from '../features/auth/authContext'
import { OfflineNotice } from './OfflineNotice'

/** Estructura común: enlace para saltar al contenido, cabecera y un único landmark `main`. */
export function AppShell({ children }: { children: ReactNode }) {
  // El contexto es opcional aquí: la carcasa también se muestra sin proveedor (por ejemplo, sin conexión).
  const auth = useContext(AuthContext)

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a href="#contenido" className="skip-link">
        {es.common.skipToContent}
      </a>
      <OfflineNotice />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            {es.appName}
          </Link>
          {auth?.status === 'signedIn' ? (
            <nav aria-label="Cuenta" className="flex items-center gap-3">
              <Link to="/alimentos" className="underline">
                {es.foods.navLink}
              </Link>
              <Link to="/perfil" className="underline">
                Perfil
              </Link>
              <button type="button" className="btn-secondary" onClick={() => void auth.signOut()}>
                {es.auth.actions.logout}
              </button>
            </nav>
          ) : null}
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
