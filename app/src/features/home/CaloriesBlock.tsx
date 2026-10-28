import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { GoalSummary } from '../goals/GoalSummary'
import { useDay } from '../meals/useDay'
import { useDayStatus } from '../meals/useDayStatus'
import { useToday } from '../meals/useToday'
import { HomeSection } from './HomeSection'

const c = es.home.calories

/**
 * Las calorías del día vigente (regla del día de la spec 003). Las cifras salen de `GoalSummary`, la misma tarjeta de la
 * vista del día, así que no pueden diferir (spec 013, FR-001).
 */
export function CaloriesBlock({ date: forced }: { date?: string } = {}) {
  const today = useToday()
  const status = useDayStatus()
  // Con un día elegido (panel de la semana) manda ese día; si no, el que propone la regla del día.
  const date = forced ?? status.data?.proposed_date ?? today
  const { query, entries } = useDay(date)

  return (
    <HomeSection title={date === today ? c.title : c.dayTitle(formatDate(date))}>
      {(status.isPending && forced === undefined) || query.isPending ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState message={es.home.loadError} onRetry={() => void query.refetch()} />
      ) : null}
      {query.isSuccess && entries.length === 0 ? (
        <p className="text-muted">{date === today ? c.empty : c.emptyDay(formatDate(date))}</p>
      ) : null}
      {query.isSuccess && entries.length > 0 ? (
        <GoalSummary date={date} today={today} entries={entries} />
      ) : null}
      {query.isSuccess ? (
        <div className="flex flex-wrap gap-3">
          <Link to={`/comidas/${date}/agregar`} className="btn-primary">
            {c.register}
          </Link>
          {entries.length > 0 ? (
            <Link to={`/comidas/${date}`} className="btn-secondary">
              {c.openDay}
            </Link>
          ) : null}
        </div>
      ) : null}
    </HomeSection>
  )
}
