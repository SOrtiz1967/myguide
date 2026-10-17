import { useLocation, useNavigate } from 'react-router'
import { es } from '../../../copy/es'
import { LoginForm } from '../LoginForm'

interface LoginLocationState {
  from?: string
  expired?: boolean
  notice?: 'passwordReset'
}

export function LoginPage() {
  const navigate = useNavigate()
  const state = (useLocation().state ?? {}) as LoginLocationState

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{es.auth.titles.login}</h1>
      {state.expired ? (
        <p role="status" className="rounded-md border border-line bg-surface px-4 py-3">
          {es.auth.sessionExpired}
        </p>
      ) : null}
      {state.notice === 'passwordReset' ? (
        <p role="status" className="rounded-md border border-line bg-surface px-4 py-3">
          {es.auth.passwordReset}
        </p>
      ) : null}
      <LoginForm onSignedIn={() => navigate(state.from ?? '/', { replace: true })} />
    </div>
  )
}
