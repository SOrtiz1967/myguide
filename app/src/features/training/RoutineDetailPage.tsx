import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { measurementLabel } from '../exercises/exerciseLists'
import { deleteRoutine, duplicateRoutine, type Routine, type RoutineExercise } from './api'
import { formatTargets } from './trainingText'
import { useRoutine } from './useRoutines'

const r = es.training.routines

function ItemCard({ item }: { item: RoutineExercise }) {
  const current = item.exercise
  const name = current?.name ?? item.exercise_name
  const typeChanged = current !== null && current.measurement_type !== item.measurement_type
  const targets = formatTargets(item.measurement_type, item)
  return (
    <article
      aria-label={name}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
    >
      <div className="min-w-0">
        <h3 className="break-words text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted">
          {measurementLabel(current?.measurement_type ?? item.measurement_type)}
        </p>
      </div>
      <p>{r.setsOf(item.sets)}</p>
      <p className="text-sm">{targets || es.training.noData}</p>
      {current === null ? <p className="text-sm text-danger">{r.missingExercise}</p> : null}
      {typeChanged ? <p className="text-sm text-danger">{r.typeChanged(targets)}</p> : null}
    </article>
  )
}

function useDuplicate(routine: Routine) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [requestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => duplicateRoutine(routine.id, requestId),
    onMutate: () => setError(null),
    onSuccess: (copyId) => {
      void queryClient.invalidateQueries({ queryKey: ['training', 'routines'] })
      void navigate(`/entrenamiento/rutinas/${copyId}`, { state: { duplicated: true } })
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : es.errors.generic),
  })
  return { duplicate: () => mutation.mutate(), pending: mutation.isPending, error }
}

function useDelete(routine: Routine) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => deleteRoutine(routine.id),
    onMutate: () => setError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['training'] })
      void navigate('/entrenamiento/rutinas', { state: { deleted: true } })
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : r.deleteFailed),
  })
  return {
    open,
    show: () => {
      setError(null)
      setOpen(true)
    },
    hide: () => setOpen(false),
    confirm: () => mutation.mutate(),
    pending: mutation.isPending,
    error,
  }
}

function RoutineView({ routine }: { routine: Routine }) {
  const state = useLocation().state as { saved?: boolean; duplicated?: boolean } | null
  const duplicate = useDuplicate(routine)
  const remove = useDelete(routine)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/entrenamiento/rutinas" className="inline-flex min-h-11 items-center underline">
          {r.back}
        </Link>
      </div>
      {state?.saved ? <SuccessMessage>{r.saved}</SuccessMessage> : null}
      {state?.duplicated ? <SuccessMessage>{r.duplicated}</SuccessMessage> : null}
      <header className="flex flex-col gap-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{routine.name}</h1>
        <p className="text-muted">{r.exerciseCount(routine.routine_exercises.length)}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link to={`/entrenamiento/rutinas/${routine.id}/editar`} className="btn-primary">
          {r.edit}
        </Link>
        <button
          type="button"
          className="btn-secondary"
          disabled={duplicate.pending}
          onClick={duplicate.duplicate}
        >
          {r.duplicate}
        </button>
        <button type="button" className="btn-secondary" onClick={remove.show}>
          {r.delete}
        </button>
      </div>
      {duplicate.error ? <ErrorState message={duplicate.error} /> : null}

      <section aria-labelledby="ejercicios-rutina" className="flex flex-col gap-3">
        <h2 id="ejercicios-rutina" className="text-xl font-semibold">
          {r.exercisesTitle}
        </h2>
        {routine.routine_exercises.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </section>

      {remove.open ? (
        <ConfirmDialog
          title={r.confirmDeleteTitle}
          description={r.confirmDeleteBody}
          confirmLabel={r.confirmDelete}
          cancelLabel={r.cancel}
          onConfirm={remove.confirm}
          onCancel={remove.hide}
          busy={remove.pending}
          error={remove.error}
        />
      ) : null}
    </div>
  )
}

/** Una rutina con sus ejercicios, series y objetivos; editar, duplicar y eliminar. */
export function RoutineDetailPage() {
  const { id = '' } = useParams()
  const { data: routine, isPending, isError, refetch } = useRoutine(id)
  const back = (
    <Link to="/entrenamiento/rutinas" className="inline-flex min-h-11 items-center underline">
      {r.back}
    </Link>
  )

  if (isPending) return <LoadingState />
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState message={r.loadError} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!routine) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={es.training.errors.notFound} />
        {back}
      </div>
    )
  }
  return <RoutineView routine={routine} />
}
