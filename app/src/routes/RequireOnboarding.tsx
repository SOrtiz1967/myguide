import { Navigate, Outlet } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { es } from '../copy/es'
import { useProfile } from '../features/profile/useProfile'

/**
 * Guarda del primer ingreso (spec 014, FR-001): mientras el recorrido no esté completo, ninguna ruta
 * privada se muestra. Si el perfil no carga no se redirige: se muestra el error con reintento.
 */
export function RequireOnboarding() {
  const { data: profile, isPending, isError, refetch } = useProfile()
  if (isPending) return <LoadingState />
  if (isError || !profile) {
    return <ErrorState message={es.onboarding.loadError} onRetry={() => void refetch()} />
  }
  if (!profile.onboarding_completed_at) return <Navigate to="/bienvenida" replace />
  return <Outlet />
}
