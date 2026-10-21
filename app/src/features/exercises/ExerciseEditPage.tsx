import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { useAuth } from '../auth/useAuth'
import { updateExercise } from './api'
import { ExerciseForm } from './ExerciseForm'
import { exerciseToFormValues } from './schema'
import { useExercise } from './useExercise'

const t = es.exercises

/** Editar un ejercicio propio (incluidas las copias). El catálogo es de solo lectura (FR-028). */
export function ExerciseEditPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const copied = (useLocation().state as { copied?: boolean } | null)?.copied === true
  const { data: exercise, isPending, isError, refetch } = useExercise(id)

  const initialValues = useMemo(
    () => (exercise ? exerciseToFormValues(exercise) : null),
    [exercise],
  )
  const back = (
    <Link to={`/ejercicios/${id}`} className="inline-flex min-h-11 items-center underline">
      {t.actions.cancel}
    </Link>
  )

  if (isPending) return <LoadingState />
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState message={t.detailError} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!exercise) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={t.notFound} />
        <Link to="/ejercicios" className="inline-flex min-h-11 items-center underline">
          {t.backToSearch}
        </Link>
      </div>
    )
  }
  if (exercise.origin !== 'own' || !initialValues) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={t.form.editNotAllowed} />
        {back}
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>{back}</div>
      <h1 className="text-2xl font-semibold tracking-tight">{t.form.editTitle}</h1>
      {copied ? <SuccessMessage>{t.form.copyCreated}</SuccessMessage> : null}
      <ExerciseForm
        userId={session?.user.id ?? ''}
        draftId={`exercise-edit-${id}`}
        initial={initialValues}
        excludeId={id}
        onSubmit={(payload) => updateExercise(id, payload)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['exercises'] })
          void navigate(`/ejercicios/${id}`, { state: { saved: true } })
        }}
      />
    </div>
  )
}
