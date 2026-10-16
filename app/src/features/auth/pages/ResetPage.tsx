import { useNavigate } from 'react-router'
import { es } from '../../../copy/es'
import { ResetForm } from '../ResetForm'

export function ResetPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{es.auth.titles.reset}</h1>
      <ResetForm
        onDone={() => navigate('/ingresar', { replace: true, state: { notice: 'passwordReset' } })}
      />
    </div>
  )
}
