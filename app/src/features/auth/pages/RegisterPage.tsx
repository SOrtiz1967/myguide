import { Link, useNavigate } from 'react-router'
import { es } from '../../../copy/es'
import { RegisterForm } from '../RegisterForm'

export function RegisterPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{es.auth.titles.register}</h1>
      <RegisterForm
        onRegistered={({ verificationEmailSent }) =>
          navigate('/', { replace: true, state: { verificationEmailSent } })
        }
      />
      <p className="text-sm">
        {es.auth.haveAccount}{' '}
        <Link to="/ingresar" className="underline">
          {es.auth.actions.login}
        </Link>
      </p>
    </div>
  )
}
