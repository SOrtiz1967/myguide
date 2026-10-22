import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { es } from '../../copy/es'
import { rescheduleWorkout, startPlannedWorkout, type SessionSummary } from './api'
import { isValidDay } from './calendar'
import { todayLocal } from './dates'
import { StartError } from './RoutinePicker'
import { useRequestIds, useTrainingAction } from './useTrainingAction'

const p = es.training.planning

interface PanelProps {
  session: SessionSummary
  onClose: () => void
  /** Se llama cuando la acción se cumplió. */
  onDone?: (message: string) => void
}

/** Mover una sesión planificada a hoy o a un día futuro, o volver a planificar una cancelada (FR-023, FR-025). */
export function ReschedulePanel({
  session,
  onClose,
  onDone,
  replan = false,
}: PanelProps & { replan?: boolean }) {
  const today = todayLocal()
  const [date, setDate] = useState(session.session_date < today ? today : session.session_date)
  const [problem, setProblem] = useState<string | null>(null)
  const requests = useRequestIds()
  const move = useTrainingAction(
    (target: string) => rescheduleWorkout(session.id, target, requests.idFor(target)),
    {
      failure: p.moveFailed,
      onSuccess: () => {
        onClose()
        onDone?.(p.moved)
      },
    },
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    setProblem(null)
    if (!isValidDay(date)) return setProblem(p.invalidDate)
    if (date < today) return setProblem(p.pastDate)
    move.run(date)
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={replan ? p.replan : p.reschedule}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`fecha-mover-${session.id}`} className="font-medium">
          {p.newDate}
        </label>
        <input
          id={`fecha-mover-${session.id}`}
          type="date"
          min={today}
          value={date}
          aria-describedby={`fecha-mover-ayuda-${session.id}`}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => setDate(event.target.value)}
          className="min-h-11 max-w-xs rounded-md border border-line bg-surface px-3 py-2"
        />
        <p id={`fecha-mover-ayuda-${session.id}`} className="text-sm text-muted">
          {p.newDateHint}
        </p>
        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={move.pending}>
          {p.moveDate}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {p.close}
        </button>
      </div>
      <StartError error={move.error} />
    </form>
  )
}

/** «¿Qué día la hiciste?» antes de registrar una sesión planificada que quedó atrás (FR-026). */
export function RegisterPanel({ session, onClose }: PanelProps) {
  const today = todayLocal()
  const navigate = useNavigate()
  const [date, setDate] = useState(today)
  const [problem, setProblem] = useState<string | null>(null)
  const requests = useRequestIds()
  const start = useTrainingAction(
    (day: string) =>
      startPlannedWorkout(session.id, day === today ? null : day, requests.idFor(day)),
    {
      failure: p.startFailed,
      onSuccess: (result) => void navigate(`/entrenamiento/sesion/${result.id}`),
    },
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    setProblem(null)
    if (!isValidDay(date)) return setProblem(p.invalidDate)
    if (date > today) return setProblem(p.futureDay)
    start.run(date)
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={p.whichDay}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`fecha-hizo-${session.id}`} className="font-medium">
          {p.whichDay}
        </label>
        <input
          id={`fecha-hizo-${session.id}`}
          type="date"
          max={today}
          value={date}
          aria-describedby={`fecha-hizo-ayuda-${session.id}`}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => setDate(event.target.value)}
          className="min-h-11 max-w-xs rounded-md border border-line bg-surface px-3 py-2"
        />
        <p id={`fecha-hizo-ayuda-${session.id}`} className="text-sm text-muted">
          {p.whichDayHint}
        </p>
        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={start.pending}>
          {p.confirmStart}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {p.close}
        </button>
      </div>
      <StartError error={start.error} />
    </form>
  )
}
