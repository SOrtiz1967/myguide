import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { fetchInProgressSession, startWorkout } from '../training/api'
import { todayLocal } from '../training/dates'
import { DueSessions } from '../training/DueSessions'
import { RoutinePicker, StartError } from '../training/RoutinePicker'
import { useDueSessions } from '../training/useCalendar'
import { useRequestIds, useTrainingAction } from '../training/useTrainingAction'
import { HomeSection } from './HomeSection'

const t = es.training
const h = t.home

/** Empezar una sesión vacía de hoy. */
function StartEmpty() {
  const navigate = useNavigate()
  const requests = useRequestIds()
  const start = useTrainingAction(() => startWorkout(null, requests.idFor('empty')), {
    failure: h.startFailed,
    onSuccess: (result) => void navigate(`/entrenamiento/sesion/${result.id}`),
  })
  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          className="btn-secondary"
          disabled={start.pending}
          onClick={() => start.run(undefined)}
        >
          {start.pending ? h.starting : h.startEmpty}
        </button>
      </div>
      <StartError error={start.error} />
    </div>
  )
}

/**
 * El entrenamiento de hoy (spec 006): la sesión en curso, las planificadas de hoy o sin registrar con sus acciones, o la
 * invitación a empezar con una rutina o una sesión vacía.
 */
export function TrainingBlock() {
  const open = useQuery({ queryKey: ['training', 'open'], queryFn: fetchInProgressSession })
  const due = useDueSessions(todayLocal())

  return (
    <HomeSection title={es.home.training.title}>
      {open.isPending ? <LoadingState /> : null}
      {open.isError ? (
        <ErrorState message={es.home.loadError} onRetry={() => void open.refetch()} />
      ) : null}
      {open.data ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <p className="font-medium">{es.home.training.continueTitle}</p>
          <p className="text-sm text-muted">{formatDate(open.data.session_date)}</p>
          <div>
            <Link to={`/entrenamiento/sesion/${open.data.id}`} className="btn-primary">
              {h.continue}
            </Link>
          </div>
        </div>
      ) : null}
      {due.isError ? (
        <ErrorState message={es.home.loadError} onRetry={() => void due.refetch()} />
      ) : (
        <DueSessions />
      )}
      {open.isSuccess && !open.data ? (
        <>
          {due.isSuccess && due.data.length === 0 ? (
            <p className="text-muted">{es.home.training.empty}</p>
          ) : null}
          <RoutinePicker />
          <StartEmpty />
        </>
      ) : null}
    </HomeSection>
  )
}
