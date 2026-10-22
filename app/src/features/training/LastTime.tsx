import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { HistoryEntryView } from './HistoryEntryView'
import { useLastTime } from './useExerciseHistory'

const h = es.training.history

/**
 * «La última vez» de un ejercicio, en un paso y sin salir de la sesión: la sesión realizada anterior más reciente. Si no
 * hay, lo dice sin inventar datos. No sugiere cargas ni compara (FR-044).
 */
export function LastTime({ exerciseId, sessionId }: { exerciseId: string; sessionId: string }) {
  const [open, setOpen] = useState(false)
  const last = useLastTime(exerciseId, sessionId, open)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? h.hideLastTime : h.lastTime}
        </button>
        <Link to={`/ejercicios/${exerciseId}/historia`} className="btn-secondary">
          {h.view}
        </Link>
      </div>
      {open ? (
        <div role="region" aria-label={h.lastTime} className="rounded-md border border-line p-3">
          {last.isPending ? <LoadingState /> : null}
          {last.isError ? (
            <ErrorState message={h.loadError} onRetry={() => void last.refetch()} />
          ) : null}
          {last.isSuccess && last.data === null ? <p className="text-muted">{h.empty}</p> : null}
          {last.data ? (
            <>
              <p className="sr-only">{h.lastTimeOn(formatDate(last.data.session_date))}</p>
              <HistoryEntryView entry={last.data} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
