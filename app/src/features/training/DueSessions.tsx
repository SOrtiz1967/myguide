import { Link } from 'react-router'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { sessionStateLabel } from './calendar'
import { todayLocal } from './dates'
import { PlannedActions } from './PlannedActions'
import { useDueSessions } from './useCalendar'

const t = es.training
const h = t.home

/** Las planificadas de hoy y las que quedaron atrás («Sin registrar»), con sus acciones. */
export function DueSessions() {
  const today = todayLocal()
  const due = useDueSessions(today)
  if (!due.data || due.data.length === 0) return null
  return (
    <section aria-labelledby="pendientes-titulo" className="flex flex-col gap-3">
      <h3 id="pendientes-titulo" className="text-lg font-semibold">
        {h.dueTitle}
      </h3>
      <ul className="flex flex-col gap-3">
        {due.data.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <Link
              to={`/entrenamiento/sesion/${session.id}`}
              className="flex min-h-11 flex-col gap-0.5 underline"
            >
              <span className="font-medium">
                {formatDate(session.session_date)} · {sessionStateLabel(session, today)}
              </span>
              <span className="text-sm text-muted">{session.routine_name ?? t.noPlan}</span>
            </Link>
            <PlannedActions session={session} />
          </li>
        ))}
      </ul>
    </section>
  )
}
