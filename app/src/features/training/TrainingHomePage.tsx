import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
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
import { todayLocal } from './dates'
import { RoutinePicker } from './RoutinePicker'
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
    <li className="border-b border-line last:border-b-0">
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
  const queryClient = useQueryClient()
  const open = useQuery({ queryKey: ['training', 'open'], queryFn: fetchInProgressSession })
  const recent = useQuery({
    queryKey: ['training', 'recent'],
    queryFn: () => fetchRecentSessions(10),
  })

  // Un identificador por intención: reintentar la misma no crea otra sesión (FR-047).
  const [emptyRequestId] = useState(newRequestId)
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

  function startEmpty() {
    if (start.isPending) return
    start.mutate({ sessionDate: null, requestId: emptyRequestId })
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <Link to="/entrenamiento/rutinas" className="btn-secondary">
          {t.routines.title}
        </Link>
      </div>

      <section aria-labelledby="hoy-titulo" className="flex flex-col gap-3">
        <h2 id="hoy-titulo" className="text-xl font-semibold">
          {h.todayTitle}
        </h2>
        {open.isPending ? <LoadingState /> : null}
        {open.isError ? (
          <ErrorState message={h.recentError} onRetry={() => void open.refetch()} />
        ) : null}
        {openSession ? (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <p className="font-medium">{h.inProgressTitle}</p>
            <p className="text-sm text-muted">{formatDate(openSession.session_date)}</p>
            <div>
              <Link to={`/entrenamiento/sesion/${openSession.id}`} className="btn-primary">
                {h.continue}
              </Link>
            </div>
          </div>
        ) : null}
        {open.isSuccess && !openSession ? <RoutinePicker /> : null}
        {open.isSuccess && !openSession ? (
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={start.isPending}
              onClick={startEmpty}
            >
              {start.isPending ? h.starting : h.startEmpty}
            </button>
          </div>
        ) : null}
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

      {open.isSuccess && !openSession ? (
        <section aria-labelledby="otra-fecha-titulo" className="flex flex-col gap-3">
          <h2 id="otra-fecha-titulo" className="text-xl font-semibold">
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
              className="min-h-11 max-w-xs rounded-md border border-line bg-surface px-3 py-2"
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
        </section>
      ) : null}

      <section aria-labelledby="recientes-titulo" className="flex flex-col gap-3">
        <h2 id="recientes-titulo" className="text-xl font-semibold">
          {h.recentTitle}
        </h2>
        {recent.isPending ? <LoadingState /> : null}
        {recent.isError ? (
          <ErrorState message={h.recentError} onRetry={() => void recent.refetch()} />
        ) : null}
        {recent.isSuccess && recent.data.length === 0 ? <EmptyState title={h.recentEmpty} /> : null}
        {recent.isSuccess && recent.data.length > 0 ? (
          <ul className="rounded-lg border border-line bg-surface px-3">
            {recent.data.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
