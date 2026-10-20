import { useNavigate, useSearchParams } from 'react-router'
import { es } from '../../copy/es'
import { useAuth } from '../auth/useAuth'
import { createExercise } from './api'
import { ExerciseForm } from './ExerciseForm'
import { emptyExerciseForm } from './schema'

/** Crear un ejercicio propio. `?nombre=` precarga lo que se buscó. */
export function ExerciseCreatePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const name = params.get('nombre') ?? ''

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.exercises.form.createTitle}</h1>
      <ExerciseForm
        userId={session?.user.id ?? ''}
        draftId="exercise-new"
        initial={{ ...emptyExerciseForm(), name }}
        onSubmit={createExercise}
        onSaved={(id) => void navigate(`/ejercicios/${id}`, { state: { saved: true } })}
        onCancel={() => void navigate('/ejercicios')}
      />
    </div>
  )
}
