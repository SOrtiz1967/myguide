import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { LoadingState } from '../../../components/LoadingState'
import { PageHeader } from '../../../components/PageHeader'
import { es } from '../../../copy/es'
import { isNetworkError } from '../../../lib/errors'
import { useToday } from '../../meals/useToday'
import { ActivityBars } from './ActivityBars'
import { countSessions, type Grouping } from './activity'
import { DEFAULT_PERIOD, inRange, PERIODS, periodRange, type Period } from './periods'
import { useCompletedDates } from './useProgress'

const copy = es.trainingActivity
const periodCopy = es.trainingProgress.periods

/** Sesiones realizadas por semana y por mes (spec 012). Solo cuenta lo realizado; sin metas, rachas ni mensajes sobre la constancia. */
export function ActivitySummaryPage() {
  const today = useToday()
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  const [grouping, setGrouping] = useState<Grouping>('week')
  const range = periodRange(period, today)
  const query = useCompletedDates(range.from)

  const dates = query.data ?? []
  const buckets = countSessions(dates, range, grouping, dates[0] ?? null)
  const total = dates.filter((date) => inRange(date, range)).length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/entrenamiento" className="inline-flex min-h-11 items-center underline">
          {copy.back}
        </Link>
      </div>
      <PageHeader title={copy.title} subtitle={copy.intro} />

      <div className="flex flex-col gap-3">
        <div role="group" aria-label={copy.periodLabel} className="flex flex-wrap gap-2">
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {periodCopy[value]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={copy.groupingLabel} className="flex flex-wrap gap-2">
          {(['week', 'month'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={grouping === value}
              onClick={() => setGrouping(value)}
            >
              {copy.groupings[value]}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          message={isNetworkError(query.error) ? copy.offline : copy.loadError}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.isSuccess && dates.length === 0 && period === 'all' ? (
        <EmptyState title={copy.empty} description={copy.emptyBody} />
      ) : null}
      {query.isSuccess && total === 0 && (dates.length > 0 || period !== 'all') ? (
        <p role="status" className="card-inset px-4 py-3">
          {copy.emptyPeriod}
        </p>
      ) : null}
      {query.isSuccess && total > 0 ? (
        <>
          <p className="font-semibold">{copy.total(total)}</p>
          <ActivityBars buckets={buckets} grouping={grouping} />
        </>
      ) : null}
    </div>
  )
}
