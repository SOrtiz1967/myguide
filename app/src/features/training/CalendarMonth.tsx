import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { useOnline } from '../../lib/useOnline'
import type { SessionSummary } from './api'
import {
  dayCounts,
  dayLabel,
  monthGrid,
  monthOf,
  monthTitle,
  sameMonth,
  shiftMonth,
  type MonthRef,
} from './calendar'
import { todayLocal } from './dates'
import { useMonthSessions } from './useCalendar'

const c = es.training.calendar

function groupByDay(sessions: SessionSummary[]): Map<string, SessionSummary[]> {
  const byDay = new Map<string, SessionSummary[]>()
  for (const session of sessions) {
    byDay.set(session.session_date, [...(byDay.get(session.session_date) ?? []), session])
  }
  return byDay
}

/** El calendario del mes: un enlace por día, con el estado de sus sesiones en texto y forma además del color. */
export function CalendarMonth() {
  const today = todayLocal()
  const online = useOnline()
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today))
  const section = useRef<HTMLElement>(null)
  const { hash } = useLocation()
  // Un enlace desde el inicio («Ver el calendario») llega directo al calendario.
  useEffect(() => {
    if (hash === '#calendario') section.current?.scrollIntoView?.()
  }, [hash])
  const { data, isPending, isError, refetch } = useMonthSessions(month)
  const byDay = groupByDay(data ?? [])
  const hasSessions = (data ?? []).some((s) => sameMonth(monthOf(s.session_date), month))

  return (
    <section
      id="calendario"
      ref={section}
      aria-labelledby="calendario-titulo"
      className="flex flex-col gap-3"
    >
      <h2 id="calendario-titulo" className="text-xl font-semibold">
        {c.title}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          {c.previous}
        </button>
        <p aria-live="polite" className="font-medium capitalize">
          {monthTitle(month)}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          {c.next}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setMonth(monthOf(today))}>
          {c.today}
        </button>
      </div>

      {!online ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3">
          {c.offline}
        </p>
      ) : isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={c.loadError} onRetry={() => void refetch()} />
      ) : (
        <>
          <div aria-hidden="true" className="grid grid-cols-7 text-center text-sm text-muted">
            {c.weekdaysShort.map((letter, index) => (
              <span key={index}>{letter}</span>
            ))}
          </div>
          <ul className="grid grid-cols-7 gap-1">
            {monthGrid(month)
              .flat()
              .map(({ date, inMonth }) => {
                const sessions = byDay.get(date) ?? []
                return (
                  <li key={date}>
                    <Link
                      to={`/entrenamiento/dia/${date}`}
                      aria-label={dayLabel(date, sessions, today)}
                      aria-current={date === today ? 'date' : undefined}
                      className={`flex min-h-14 flex-col items-center gap-0.5 rounded-md border p-1 text-sm ${
                        date === today ? 'border-accent border-2' : 'border-line'
                      } ${inMonth ? 'bg-surface' : 'bg-transparent text-muted'}`}
                    >
                      <span>{Number(date.slice(8))}</span>
                      <span aria-hidden="true" className="flex flex-wrap justify-center gap-x-1">
                        {dayCounts(sessions, today).map(({ state, count }) => (
                          <span key={state}>
                            {c.symbol[state]}
                            {count > 1 ? count : ''}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ul>
          {!hasSessions ? <p className="text-muted">{c.emptyMonth}</p> : null}
        </>
      )}
    </section>
  )
}
