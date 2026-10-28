import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { startWorkout } from './api'
import { RoutinePicker, StartError } from './RoutinePicker'
import { markLabels, statusLabel } from './trainingText'
import { useDaySessions } from './useCalendar'
import { useMarkWorkoutDone } from './useMarkWorkoutDone'
import { useRoutines } from './useRoutines'
import { useRequestIds, useTrainingAction } from './useTrainingAction'
import { planDayFor, useWeeklyPlan } from './useWeeklyPlan'

const t = es.training
const today = t.today
const h = t.home

/** Empezar una sesión vacía de un día (hoy, o una fecha pasada). */
function StartEmpty({ date }: { date: string | null }) {
  const navigate = useNavigate()
  const requests = useRequestIds()
  const start = useTrainingAction(
    () => startWorkout(date, requests.idFor(`empty:${date ?? 'hoy'}`)),
    {
      failure: h.startFailed,
      onSuccess: (result) => void navigate(`/entrenamiento/sesion/${result.id}`),
    },
  )
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

/** Cargar un entrenamiento: una rutina que ya existe, una nueva o uno vacío. No cambia el plan semanal. */
function LoadPanel({ date, isToday }: { date: string; isToday: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold">{today.loadTitle}</h3>
        <p className="text-sm text-muted">{today.loadHint}</p>
      </div>
      <RoutinePicker markDoneDate={isToday ? null : date} sessionDate={isToday ? null : date} />
      <div className="flex flex-wrap gap-3">
        <Link to="/entrenamiento/rutinas/nueva" className="btn-secondary">
          {today.newRoutine}
        </Link>
      </div>
      <StartEmpty date={isToday ? null : date} />
    </div>
  )
}

interface WorkoutDayActionsProps {
  /** El día (`AAAA-MM-DD`). */
  date: string
  /** «Hoy» en la zona de la persona. */
  today: string
  /** Mostrar las sesiones ya realizadas de ese día (el inicio de hoy las muestra aquí). */
  showCompleted?: boolean
  /** Hay una sesión en curso: no se ofrece empezar otra, solo continuar la abierta. */
  hasOpenSession?: boolean
}

/**
 * Lo que se puede hacer con el entrenamiento de un día (spec 018): marcar como completada la rutina que toca según el
 * plan semanal, cargar un entrenamiento distinto o, si el día no tiene rutina asignada, cargar el que se hizo. Un día
 * futuro solo muestra lo que toca. Nada de esto cambia el plan.
 */
export function WorkoutDayActions({
  date,
  today: todayDate,
  showCompleted = false,
  hasOpenSession = false,
}: WorkoutDayActionsProps) {
  const isToday = date === todayDate
  const sessions = useDaySessions(date)
  const plan = useWeeklyPlan()
  const routines = useRoutines()
  const done = useMarkWorkoutDone(isToday ? null : date)
  const [open, setOpen] = useState(false)

  const row = planDayFor(plan.data, date)
  const routineId = row?.routine_id ?? null
  const routine = routines.data?.find((r) => r.id === routineId) ?? null

  if (date > todayDate) {
    return (
      <p className="text-muted">
        {routineId && row ? today.planFuture(row.routine_name) : today.noPlanFuture}
      </p>
    )
  }

  if (sessions.isPending || plan.isPending) return <LoadingState />
  if (sessions.isError) {
    return <ErrorState message={es.home.loadError} onRetry={() => void sessions.refetch()} />
  }

  const completed = (sessions.data ?? []).filter((s) => s.status === 'completed')
  // Una sesión planificada a mano para ese día manda sobre el plan semanal (FR-018): el día no se cuenta dos veces.
  const explicit = (sessions.data ?? []).some((s) => s.status === 'planned')
  const offerPlan = routineId !== null && completed.length === 0 && !explicit && !hasOpenSession
  const showLoad = !hasOpenSession && !explicit && (open || (!offerPlan && completed.length === 0))

  return (
    <div className="flex flex-col gap-3">
      {showCompleted && completed.length > 0 ? (
        <section aria-labelledby={`registrado-${date}`} className="flex flex-col gap-2">
          <h3 id={`registrado-${date}`} className="text-base font-bold">
            {today.doneTitle}
          </h3>
          <ul className="flex flex-col gap-2">
            {completed.map((session) => (
              <li key={session.id} className="card-inset">
                <Link
                  to={`/entrenamiento/sesion/${session.id}`}
                  className="flex min-h-11 flex-col gap-0.5"
                >
                  <span className="font-medium">
                    {session.routine_name ?? statusLabel(session.status)}
                  </span>
                  <span className="text-sm text-muted">
                    {[formatDate(session.session_date), ...markLabels(session)].join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {offerPlan && row ? (
        <div className="card-inset flex flex-col gap-3">
          <div>
            <p className="text-xl font-extrabold">
              {isToday ? today.planned(row.routine_name) : today.plannedDay(row.routine_name)}
            </p>
            <p className="text-sm text-muted">
              {routine
                ? `${today.exerciseCount(routine.routine_exercises.length)} · ${today.planOf}`
                : today.planOf}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={done.pending || routine === null}
            onClick={() => routineId && done.mark(routineId)}
          >
            {done.pending ? today.marking : today.markDone}
          </button>
          <button
            type="button"
            className="btn-quiet"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {today.other}
          </button>
          <StartError error={done.error} />
        </div>
      ) : null}

      {row && row.routine_id === null && completed.length === 0 ? (
        <p className="text-sm text-muted">{t.weeklyPlan.goneRoutine(row.routine_name)}</p>
      ) : null}

      {!offerPlan && !hasOpenSession && !explicit && completed.length > 0 ? (
        <div>
          <button
            type="button"
            className="btn-quiet"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {today.load}
          </button>
        </div>
      ) : null}

      {showLoad ? <LoadPanel date={date} isToday={isToday} /> : null}
    </div>
  )
}
