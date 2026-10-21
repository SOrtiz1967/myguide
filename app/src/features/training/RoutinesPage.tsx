import { Link, useLocation } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { useRoutines } from './useRoutines'

const r = es.training.routines

/** La lista de rutinas de la cuenta: su catálogo de entrenamientos, sin días asignados. */
export function RoutinesPage() {
  const { data, isPending, isError, refetch } = useRoutines()
  const deleted = (useLocation().state as { deleted?: boolean } | null)?.deleted === true

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/entrenamiento" className="inline-flex min-h-11 items-center underline">
          {es.training.session.back}
        </Link>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
        <Link to="/entrenamiento/rutinas/nueva" className="btn-primary">
          {r.newRoutine}
        </Link>
      </div>

      {deleted ? <SuccessMessage>{r.deleted}</SuccessMessage> : null}
      {isPending ? <LoadingState /> : null}
      {isError ? <ErrorState message={r.loadError} onRetry={() => void refetch()} /> : null}
      {data && data.length === 0 ? <EmptyState title={r.empty} description={r.emptyBody} /> : null}
      {data && data.length > 0 ? (
        <ul className="rounded-lg border border-line bg-surface px-3">
          {data.map((routine) => (
            <li key={routine.id} className="border-b border-line last:border-b-0">
              <Link
                to={`/entrenamiento/rutinas/${routine.id}`}
                className="flex min-h-11 flex-col gap-0.5 px-1 py-3"
              >
                <span className="break-words font-medium">{routine.name}</span>
                <span className="text-sm text-muted">
                  {r.exerciseCount(routine.routine_exercises.length)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
