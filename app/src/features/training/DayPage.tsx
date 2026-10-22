import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { planWorkout, startWorkout, type SessionSummary } from './api'
import { isValidDay, sessionStateLabel } from './calendar'
import { todayLocal } from './dates'
import { PlannedActions } from './PlannedActions'
import { StartError } from './RoutinePicker'
import { markLabels } from './trainingText'
import { useDaySessions } from './useCalendar'
import { useRoutines } from './useRoutines'
import { useRequestIds, useTrainingAction } from './useTrainingAction'

const t = es.training
const p = t.planning

function DaySession({ session, today }: { session: SessionSummary; today: string }) {
  const marks = markLabels(session)
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <Link
        to={`/entrenamiento/sesion/${session.id}`}
        className="flex min-h-11 flex-col gap-0.5 underline"
      >
        <span className="font-medium">
          {[sessionStateLabel(session, today), ...marks].join(' · ')}
        </span>
        <span className="text-sm text-muted">{session.routine_name ?? t.noPlan}</span>
      </Link>
      <PlannedActions session={session} />
    </li>
  )
}

/** Planificar una rutina, o una sesión vacía, para hoy o un día futuro. */
function PlanSection({ day }: { day: string }) {
  const { data, isPending, isError, refetch } = useRoutines()
  const [planned, setPlanned] = useState(false)
  const requests = useRequestIds()
  const plan = useTrainingAction(
    (routineId: string | null) => planWorkout(day, routineId, requests.idFor(routineId ?? 'empty')),
    {
      failure: p.planFailed,
      onSuccess: (_id, routineId) => {
        requests.reset(routineId ?? 'empty')
        setPlanned(true)
      },
    },
  )
  return (
    <section aria-labelledby="planificar-titulo" className="flex flex-col gap-3">
      <h2 id="planificar-titulo" className="text-xl font-semibold">
        {p.planTitle}
      </h2>
      {planned ? <SuccessMessage>{p.planned}</SuccessMessage> : null}
      {isPending ? <LoadingState /> : null}
      {isError ? (
        <ErrorState message={t.routines.loadError} onRetry={() => void refetch()} />
      ) : null}
      {data && data.length === 0 ? <p className="text-muted">{p.planEmpty}</p> : null}
      {data && data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                className="btn-secondary w-full justify-between text-left"
                disabled={plan.pending}
                onClick={() => {
                  setPlanned(false)
                  plan.run(routine.id)
                }}
              >
                <span className="break-words">{p.planWith(routine.name)}</span>
                <span className="text-sm text-muted">
                  {t.routines.exerciseCount(routine.routine_exercises.length)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <button
          type="button"
          className="btn-secondary"
          disabled={plan.pending}
          onClick={() => {
            setPlanned(false)
            plan.run(null)
          }}
        >
          {p.planEmptySession}
        </button>
      </div>
      <StartError error={plan.error} />
    </section>
  )
}

/** Registrar lo que se hizo un día de hoy o pasado. */
function RegisterSection({ day }: { day: string }) {
  const navigate = useNavigate()
  const requests = useRequestIds()
  const start = useTrainingAction(() => startWorkout(day, requests.idFor('register')), {
    failure: t.home.startFailed,
    onSuccess: (result) => void navigate(`/entrenamiento/sesion/${result.id}`),
  })
  return (
    <section aria-labelledby="registrar-titulo" className="flex flex-col gap-3">
      <h2 id="registrar-titulo" className="text-xl font-semibold">
        {p.registerTitle}
      </h2>
      <div>
        <button
          type="button"
          className="btn-secondary"
          disabled={start.pending}
          onClick={() => start.run(undefined)}
        >
          {p.register}
        </button>
      </div>
      <StartError error={start.error} />
    </section>
  )
}

/** Las sesiones de un día y lo que se puede hacer ese día. */
export function TrainingDayPage() {
  const { fecha } = useParams()
  const valid = isValidDay(fecha)
  const day = valid ? fecha : ''
  const sessions = useDaySessions(day)
  const today = todayLocal()
  const back = (
    <Link to="/entrenamiento" className="inline-flex min-h-11 items-center underline">
      {p.dayBack}
    </Link>
  )

  if (!valid) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={p.invalidDay} />
        {back}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>{back}</div>
      <h1 className="text-2xl font-semibold tracking-tight">{p.dayTitle(formatDate(day))}</h1>

      <section aria-labelledby="sesiones-dia-titulo" className="flex flex-col gap-3">
        <h2 id="sesiones-dia-titulo" className="text-xl font-semibold">
          {p.sessionsTitle}
        </h2>
        {sessions.isPending ? <LoadingState /> : null}
        {sessions.isError ? (
          <ErrorState message={t.home.recentError} onRetry={() => void sessions.refetch()} />
        ) : null}
        {sessions.isSuccess && sessions.data.length === 0 ? (
          <p className="text-muted">{p.noSessions}</p>
        ) : null}
        {sessions.isSuccess && sessions.data.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {sessions.data.map((session) => (
              <DaySession key={session.id} session={session} today={today} />
            ))}
          </ul>
        ) : null}
      </section>

      {day >= today ? (
        <PlanSection day={day} />
      ) : (
        <p className="text-muted">{p.pastOnlyRegister}</p>
      )}
      {day <= today ? <RegisterSection day={day} /> : null}
    </div>
  )
}
