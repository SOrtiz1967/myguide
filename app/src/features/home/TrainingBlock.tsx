import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { fetchInProgressSession } from '../training/api'
import { todayLocal } from '../training/dates'
import { DueSessions } from '../training/DueSessions'
import { useDueSessions } from '../training/useCalendar'
import { useWeeklyPlan, planDayFor } from '../training/useWeeklyPlan'
import { WorkoutDayActions } from '../training/WorkoutDayActions'
import { HomeSection } from './HomeSection'

const t = es.training
const h = t.home

/**
 * El entrenamiento de hoy (specs 006 y 018): la sesión en curso, las planificadas de hoy o sin registrar con sus
 * acciones, la rutina que toca según el plan semanal para marcarla como completada, o «Cargar entrenamiento».
 */
export function TrainingBlock({ className = 'lg:col-span-2' }: { className?: string } = {}) {
  const open = useQuery({ queryKey: ['training', 'open'], queryFn: fetchInProgressSession })
  const today = todayLocal()
  const due = useDueSessions(today)
  const plan = useWeeklyPlan()
  const planned = planDayFor(plan.data, today)
  const hasDue = due.isSuccess && due.data.length > 0

  return (
    <HomeSection tone="training" className={className} title={es.home.training.title}>
      {open.isPending ? <LoadingState /> : null}
      {open.isError ? (
        <ErrorState message={es.home.loadError} onRetry={() => void open.refetch()} />
      ) : null}
      {open.data ? (
        <div className="card-inset flex flex-col gap-3">
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
      {open.isSuccess ? (
        <>
          {due.isSuccess && !hasDue && !planned?.routine_id && !open.data ? (
            <p className="text-muted">{es.home.training.empty}</p>
          ) : null}
          <WorkoutDayActions
            date={today}
            today={today}
            showCompleted
            hasOpenSession={open.data !== null}
          />
        </>
      ) : null}
    </HomeSection>
  )
}
