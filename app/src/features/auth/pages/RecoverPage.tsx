import { Link } from 'react-router'
import { es } from '../../../copy/es'
import { RecoverForm } from '../RecoverForm'

export function RecoverPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{es.auth.titles.recover}</h1>
      <RecoverForm />
      <p className="text-sm">
        <Link to="/ingresar" className="underline">
          {es.auth.goToLogin}
        </Link>
      </p>
    </div>
  )
}
