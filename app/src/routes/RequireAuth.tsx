import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingState } from '../components/LoadingState'
import { useAuth } from '../features/auth/useAuth'

/**
 * Guarda de rutas privadas (FR-012). Mientras se resuelve la sesión no redirige; sin sesión manda a
 * /ingresar sin montar el contenido, así que no se pide ningún dato privado.
 */
export function RequireAuth() {
  const { status, expired } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingState />
  if (status === 'signedOut') {
    // `expired` lleva el aviso de vencimiento por inactividad a la pantalla de ingreso (FR-003).
    return <Navigate to="/ingresar" replace state={{ from: location.pathname, expired }} />
  }
  return <Outlet />
}
