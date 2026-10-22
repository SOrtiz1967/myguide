import { Link, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { useExercise } from '../exercises/useExercise'
import { HistoryEntryView } from './HistoryEntryView'
import { useExerciseHistory } from './useExerciseHistory'

const h = es.training.history

/** Las últimas veces que se hizo un ejercicio, de la más reciente a la más antigua. Sin metas ni comparaciones. */
export function ExerciseHistoryPage() {
  const { id = '' } = useParams()
  const exercise = useExercise(id)
  const history = useExerciseHistory(id)
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to={`/ejercicios/${id}`} className="inline-flex min-h-11 items-center underline">
          {h.back}
        </Link>
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{h.title}</h1>
        {exercise.data ? <p className="break-words text-muted">{exercise.data.name}</p> : null}
      </header>

      {history.isPending ? <LoadingState /> : null}
      {history.isError ? (
        <ErrorState message={h.loadError} onRetry={() => void history.refetch()} />
      ) : null}
      {history.isSuccess && entries.length === 0 ? (
        <EmptyState title={h.empty} description={h.emptyBody} />
      ) : null}
      {entries.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li
              key={`${entry.session_id}-${entry.exercise_name}`}
              className="rounded-lg border border-line bg-surface p-4"
            >
              <HistoryEntryView entry={entry} />
            </li>
          ))}
        </ul>
      ) : null}
      {history.hasNextPage ? (
        <div>
          <button
            type="button"
            className="btn-secondary"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {h.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  )
}
