import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { cancelWorkout, setWorkoutRoutine, startPlannedWorkout, type SessionSummary } from './api'
import { todayLocal } from './dates'
import { RegisterPanel, ReschedulePanel } from './ReschedulePanel'
import { StartError } from './RoutinePicker'
import { useRoutines } from './useRoutines'
import { useRequestIds, useTrainingAction } from './useTrainingAction'

const p = es.training.planning

type Panel = 'reschedule' | 'register' | 'routine' | null

/** Cambiar la rutina de una sesión planificada, o quitarle el plan (FR-027a). */
function RoutineChangePanel({
  session,
  onClose,
  onDone,
}: {
  session: SessionSummary
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { data, isPending, isError, refetch } = useRoutines()
  const change = useTrainingAction(
    (routineId: string | null) => setWorkoutRoutine(session.id, routineId),
    {
      failure: p.routineFailed,
      onSuccess: () => {
        onClose()
        onDone(p.routineChanged)
      },
    },
  )
  return (
    <section
      aria-label={p.changeRoutine}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <h3 className="font-medium">{p.changeRoutine}</h3>
      {isPending ? <LoadingState /> : null}
      {isError ? (
        <ErrorState message={es.training.routines.loadError} onRetry={() => void refetch()} />
      ) : null}
      {data ? (
        <ul className="flex flex-col gap-2">
          {data.map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                className="btn-secondary w-full text-left"
                disabled={change.pending}
                onClick={() => change.run(routine.id)}
              >
                {p.useRoutine(routine.name)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {session.has_plan ? (
        <div>
          <button
            type="button"
            className="btn-secondary"
            disabled={change.pending}
            onClick={() => change.run(null)}
          >
            {p.removeRoutine}
          </button>
        </div>
      ) : null}
      <div>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {p.close}
        </button>
      </div>
      <StartError error={change.error} />
    </section>
  )
}

/**
 * Las acciones de una sesión planificada o cancelada: empezar o registrar, reprogramar, cancelar, volver a planificar y
 * cambiar la rutina. Una planificada con fecha pasada se rotula «Sin registrar» y ofrece las mismas acciones.
 */
export function PlannedActions({
  session,
  withRoutineChange = false,
}: {
  session: SessionSummary
  withRoutineChange?: boolean
}) {
  const today = todayLocal()
  const navigate = useNavigate()
  const [panel, setPanel] = useState<Panel>(null)
  const [message, setMessage] = useState<string | null>(null)
  const requests = useRequestIds()
  const close = () => setPanel(null)

  const start = useTrainingAction(
    () => startPlannedWorkout(session.id, null, requests.idFor('start')),
    {
      failure: p.startFailed,
      onSuccess: (result) => void navigate(`/entrenamiento/sesion/${result.id}`),
    },
  )
  const cancel = useTrainingAction(() => cancelWorkout(session.id), {
    failure: p.cancelFailed,
    onSuccess: () => setMessage(p.cancelled),
  })

  if (session.status === 'cancelled') {
    return (
      <div className="flex flex-col gap-3">
        {message ? <SuccessMessage>{message}</SuccessMessage> : null}
        {panel === 'reschedule' ? (
          <ReschedulePanel session={session} replan onClose={close} onDone={setMessage} />
        ) : (
          <div>
            <button type="button" className="btn-primary" onClick={() => setPanel('reschedule')}>
              {p.replan}
            </button>
          </div>
        )}
      </div>
    )
  }
  if (session.status !== 'planned') return null

  const isToday = session.session_date === today
  const isPast = session.session_date < today
  return (
    <div className="flex flex-col gap-3">
      {message ? <SuccessMessage>{message}</SuccessMessage> : null}
      <div className="flex flex-wrap gap-3">
        {isToday ? (
          <button
            type="button"
            className="btn-primary"
            disabled={start.pending}
            onClick={() => start.run(undefined)}
          >
            {p.start}
          </button>
        ) : null}
        {isPast ? (
          <button type="button" className="btn-primary" onClick={() => setPanel('register')}>
            {p.registerAction}
          </button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={() => setPanel('reschedule')}>
          {p.reschedule}
        </button>
        {withRoutineChange ? (
          <button type="button" className="btn-secondary" onClick={() => setPanel('routine')}>
            {p.changeRoutine}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-secondary"
          disabled={cancel.pending}
          onClick={() => cancel.run(undefined)}
        >
          {p.cancel}
        </button>
      </div>
      {panel === 'reschedule' ? (
        <ReschedulePanel session={session} onClose={close} onDone={setMessage} />
      ) : null}
      {panel === 'register' ? <RegisterPanel session={session} onClose={close} /> : null}
      {panel === 'routine' ? (
        <RoutineChangePanel session={session} onClose={close} onDone={setMessage} />
      ) : null}
      <StartError error={start.error ?? cancel.error} />
    </div>
  )
}
