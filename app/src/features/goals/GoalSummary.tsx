import { useId } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { es } from '../../copy/es'
import { summarizeDay, type DaySummary, type SummaryEntry } from './daySummary'
import { goalOn } from './goalHistory'
import { LowGoalNote } from './LowGoalNote'
import { LOW_GOAL_KCAL } from './schema'
import { useGoalHistory } from './useGoalHistory'

interface GoalSummaryProps {
  /** El día que se está viendo (`AAAA-MM-DD`). */
  date: string
  /** "Hoy" en la zona de la persona: la invitación a fijar un objetivo solo aparece hoy o después. */
  today: string
  /** Los ítems de ese día, los mismos que ya trae la vista del día. */
  entries: readonly SummaryEntry[]
}

const linkClass = 'inline-flex min-h-11 items-center underline'

/**
 * La tarjeta "Objetivo del día" (spec 004). Sin objetivo en ese día muestra solo lo registrado: ningún
 * campo del objetivo existe en el resumen, así que no puede mostrar restantes, porcentaje ni barra
 * (FR-002, SC-009).
 */
export function GoalSummary({ date, today, entries }: GoalSummaryProps) {
  const titleId = useId()
  const history = useGoalHistory()

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {es.goal.cardTitle}
      </h2>
      {history.isPending ? (
        <p role="status" className="text-muted">
          {es.goal.page.loading}
        </p>
      ) : history.isError ? (
        <ErrorState message={es.goal.loadError} onRetry={() => void history.refetch()} />
      ) : (
        <Body
          summary={summarizeDay(entries, goalOn(history.data, date))}
          date={date}
          today={today}
        />
      )}
    </section>
  )
}

/** Las aclaraciones de incertidumbre: solo cuando corresponden (FR-015 a FR-017). */
function Notes({ summary }: { summary: DaySummary }) {
  const withGoal = summary.state !== 'none'
  if (summary.missing === 0 && summary.pending === 0) return null
  return (
    <div className="flex flex-col gap-1 text-sm text-muted">
      {summary.missing > 0 ? <p>{es.goal.missingNote(summary.missing)}</p> : null}
      {summary.pending > 0 ? <p>{es.goal.pendingNote(summary.pending, withGoal)}</p> : null}
    </div>
  )
}

function Body({ summary, date, today }: { summary: DaySummary; date: string; today: string }) {
  if (summary.state === 'none') {
    return (
      <>
        <p className="font-medium">{es.goal.registered(summary.registered, summary.lowerBound)}</p>
        <Notes summary={summary} />
        {date >= today ? (
          <Link to={`/objetivo?volver=${date}`} className={linkClass}>
            {es.goal.invite}
          </Link>
        ) : null}
      </>
    )
  }

  const statement =
    summary.state === 'over'
      ? es.goal.statement({
          state: 'over',
          difference: summary.difference ?? 0,
          lowerBound: summary.lowerBound,
        })
      : es.goal.statement({
          state: summary.state,
          remaining: summary.remaining,
          lowerBound: summary.lowerBound,
        })

  return (
    <>
      <p>{es.goal.goalLine(summary.goal)}</p>
      <p>{es.goal.registered(summary.registered, summary.lowerBound)}</p>
      <p className="text-lg font-semibold">{statement}</p>
      <p className="text-muted">{es.goal.equation(summary)}</p>
      <p>{es.goal.percent(summary.percent)}</p>
      {/* La barra es decorativa: lo que importa está dicho en texto. Llega al tope sin cambiar de estilo. */}
      <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          data-goal-bar
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(summary.percent, 100)}%` }}
        />
      </div>
      <Notes summary={summary} />
      {summary.goal < LOW_GOAL_KCAL ? <LowGoalNote /> : null}
      <Link to={`/objetivo?volver=${date}`} className={linkClass}>
        {es.goal.change}
      </Link>
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center underline">
          {es.goal.howTitle}
        </summary>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted">
          {es.goal.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </>
  )
}
