import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { es } from '../../../copy/es'
import { clearLoginNotice, peekLoginNotice } from '../../../lib/loginNotice'
import { LoginForm } from '../LoginForm'

interface LoginLocationState {
  from?: string
  expired?: boolean
  notice?: 'passwordReset' | 'accountDeleted'
}

export function LoginPage() {
  const navigate = useNavigate()
  const state = (useLocation().state ?? {}) as LoginLocationState
  const [stored] = useState(peekLoginNotice)
  const notice = state.notice ?? stored
  useEffect(() => clearLoginNotice, [])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{es.auth.titles.login}</h1>
      {state.expired ? (
        <p role="status" className="card-inset px-4 py-3">
          {es.auth.sessionExpired}
        </p>
      ) : null}
      {notice === 'passwordReset' ? (
        <p role="status" className="card-inset px-4 py-3">
          {es.auth.passwordReset}
        </p>
      ) : null}
      {notice === 'accountDeleted' ? (
        <p role="status" className="card-inset px-4 py-3">
          {es.auth.accountDeleted}
        </p>
      ) : null}
      <LoginForm onSignedIn={() => navigate(state.from ?? '/', { replace: true })} />
    </div>
  )
}
