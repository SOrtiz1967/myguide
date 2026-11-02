import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import {
  fetchInProgressSession,
  fetchRecentSessions,
  SessionInProgressError,
  startWorkout,
  type SessionSummary,
} from './api'
import { TrainingBlock } from '../home/TrainingBlock'
import { CalendarMonth } from './CalendarMonth'
import { todayLocal } from './dates'
import { WeeklyPlanPanel } from './WeeklyPlanPanel'
import { markLabels, statusLabel } from './trainingText'

const t = es.training
const h = t.home

interface StartError {
  message: string
  /** La sesión que ya está abierta, para ofrecer continuarla. */
  openId: string | null
}

function SessionRow({ session }: { session: SessionSummary }) {
  const marks = markLabels(session)
  return (
    <li className="border-b border-line/25 last:border-b-0">
      <Link
        to={`/entrenamiento/sesion/${session.id}`}
        className="flex min-h-11 flex-col gap-0.5 px-1 py-3"
      >
        <span className="font-medium">{formatDate(session.session_date)}</span>
        <span className="text-sm text-muted">
          {[statusLabel(session.status), ...marks].join(' · ')}
          {session.routine_name ? ` · ${session.routine_name}` : ''}
        </span>
      </Link>
    </li>
  )
}

/** Inicio de entrenamiento: «Hoy», continuar una sesión abierta, registrar otra fecha y las últimas sesiones. */
export function TrainingHomePage() {
  const navigate = useNavigate()
  const deleted = (useLocation().state as { deleted?: boolean } | null)?.deleted
  const queryClient = useQueryClient()
  const open = useQuery({ queryKey: ['training', 'open'], queryFn: fetchInProgressSession })
  const recent = useQuery({
    queryKey: ['training', 'recent'],
    queryFn: () => fetchRecentSessions(10),
  })

  // Un identificador por intención: reintentar la misma no crea otra sesión (FR-047).
  const dateRequest = useRef<{ date: string; id: string } | null>(null)
  const [date, setDate] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const [startError, setStartError] = useState<StartError | null>(null)

  const start = useMutation({
    mutationFn: ({ sessionDate, requestId }: { sessionDate: string | null; requestId: string }) =>
      startWorkout(sessionDate, requestId),
    onMutate: () => setStartError(null),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['training'] })
      void navigate(`/entrenamiento/sesion/${result.id}`)
    },
    onError: (error) =>
      setStartError(
        error instanceof SessionInProgressError
          ? { message: t.errors.sessionInProgress, openId: error.sessionId }
          : { message: error instanceof WriteError ? error.message : h.startFailed, openId: null },
      ),
  })

  function registerOtherDate() {
    if (start.isPending) return
    setDateError(null)
    if (!date) return setDateError(h.invalidDate)
    if (date > todayLocal()) return setDateError(h.futureDate)
    if (dateRequest.current?.date !== date) dateRequest.current = { date, id: newRequestId() }
    start.mutate({ sessionDate: date, requestId: dateRequest.current.id })
  }

  const openSession = open.data

  return (
    <div className="flex flex-col gap-6">
      {deleted ? <SuccessMessage>{t.session.deleted}</SuccessMessage> : null}
      <PageHeader
        title={t.title}
        action={
          <div className="flex flex-wrap gap-3">
            <Link to="/entrenamiento/resumen" className="btn-secondary">
              {es.trainingProgress.seeSummary}
            </Link>
            <Link to="/entrenamiento/rutinas" className="btn-secondary">
              {t.routines.title}
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrainingBlock className="" />
        <WeeklyPlanPanel />
      </div>

      {open.isSuccess && !openSession ? (
        <section aria-labelledby="otra-fecha-titulo" className="card flex flex-col gap-3">
          <h2 id="otra-fecha-titulo" className="text-lg font-extrabold">
            {h.otherDateTitle}
          </h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="fecha-entrenamiento" className="font-medium">
              {h.otherDateLabel}
            </label>
            <input
              id="fecha-entrenamiento"
              type="date"
              max={todayLocal()}
              value={date}
              aria-describedby="fecha-ayuda"
              aria-invalid={dateError ? true : undefined}
              onChange={(event) => setDate(event.target.value)}
              className="min-h-11 max-w-xs control px-3 py-2"
            />
            <p id="fecha-ayuda" className="text-sm text-muted">
              {h.otherDateHint}
            </p>
            {dateError ? <p className="text-sm text-danger">{dateError}</p> : null}
          </div>
          <div>
            <button
              type="button"
              className="btn-secondary"
              disabled={start.isPending}
              onClick={registerOtherDate}
            >
              {h.register}
            </button>
          </div>
          {startError ? (
            <div className="flex flex-col gap-3">
              <ErrorState message={startError.message} />
              {startError.openId ? (
                <div>
                  <Link to={`/entrenamiento/sesion/${startError.openId}`} className="btn-secondary">
                    {h.continue}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <CalendarMonth />

      <section aria-labelledby="recientes-titulo" className="card flex flex-col gap-3">
        <h2 id="recientes-titulo" className="text-lg font-extrabold">
          {h.recentTitle}
        </h2>
        {recent.isPending ? <LoadingState /> : null}
        {recent.isError ? (
          <ErrorState message={h.recentError} onRetry={() => void recent.refetch()} />
        ) : null}
        {recent.isSuccess && recent.data.length === 0 ? <EmptyState title={h.recentEmpty} /> : null}
        {recent.isSuccess && recent.data.length > 0 ? (
          <ul className="rounded-xl bg-surface px-3">
            {recent.data.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
