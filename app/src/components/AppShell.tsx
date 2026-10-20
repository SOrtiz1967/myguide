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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 px-4 py-2">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            {es.appName}
          </Link>
          {auth?.status === 'signedIn' ? (
            <nav aria-label="Cuenta" className="flex flex-wrap items-center gap-x-3">
              <Link to="/comidas" className="inline-flex min-h-11 items-center underline">
                {es.meals.navLink}
              </Link>
              <Link to="/alimentos" className="inline-flex min-h-11 items-center underline">
                {es.foods.navLink}
              </Link>
              <Link to="/ejercicios" className="inline-flex min-h-11 items-center underline">
                {es.exercises.navLink}
              </Link>
              <Link to="/perfil" className="inline-flex min-h-11 items-center underline">
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
