import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { MealPhoto } from './MealPhoto'
import { addDays, formatDay, formatDayShort, isDateInRange, MEALS, parseDate } from './meals'
import { ClosingDayNotice } from './ClosingDayNotice'
import { MealSection, TotalsList } from './MealSection'
import { useDay } from './useDay'
import { useDayStatus } from './useDayStatus'
import { usePhotos } from './usePhotos'
import { useToday } from './useToday'

const linkClass = 'inline-flex min-h-11 items-center underline'

export function DayPage() {
  const { fecha = '' } = useParams()
  const today = useToday()
  const date = parseDate(fecha)

  if (!date || !isDateInRange(date, today)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{es.meals.title}</h1>
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
          {es.meals.day.invalidDate}
        </p>
        <Link to="/comidas" className={linkClass}>
          {es.meals.day.goToday}
        </Link>
      </div>
    )
  }
  return <Day date={date} today={today} />
}

function Day({ date, today }: { date: string; today: string }) {
  const navigate = useNavigate()
  const added = (useLocation().state as { added?: string } | null)?.added
  const { query, entries, grouped, dayTotal, subtotal } = useDay(date)
  const status = useDayStatus().data
  const closing = status?.closing && status.proposed_date === date ? status : null
  const photos = usePhotos(date).data
  const previous = addDays(date, -1)
  const next = addDays(date, 1)
  const canGoNext = isDateInRange(next, today)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {formatDay(date)}
          {date === today ? ` · ${es.meals.day.today}` : ''}
        </h1>
        <nav aria-label={es.meals.title} className="flex flex-wrap items-center gap-x-4">
          <Link
            to={`/comidas/${previous}`}
            aria-label={es.meals.day.previous(formatDayShort(previous))}
            className={linkClass}
          >
            ‹ {formatDayShort(previous)}
          </Link>
          {canGoNext ? (
            <Link
              to={`/comidas/${next}`}
              aria-label={es.meals.day.next(formatDayShort(next))}
              className={linkClass}
            >
              {formatDayShort(next)} ›
            </Link>
          ) : null}
          {date !== today ? (
            <Link to={`/comidas/${today}`} className={linkClass}>
              {es.meals.day.today}
            </Link>
          ) : null}
          <label className="flex min-h-11 items-center gap-2">
            <span>{es.meals.day.pickDate}</span>
            <input
              type="date"
              value={date}
              min="2000-01-01"
              max={addDays(today, 7)}
              onChange={(event) => {
                const picked = parseDate(event.target.value)
                if (picked) void navigate(`/comidas/${picked}`)
              }}
              className="min-h-11 rounded-md border border-line bg-surface px-2"
            />
          </label>
        </nav>
      </header>

      {added ? <SuccessMessage>{added}</SuccessMessage> : null}
      {closing ? <ClosingDayNotice status={closing} /> : null}

      {query.isPending ? <LoadingState label={es.meals.day.loading} /> : null}
      {query.isError ? (
        <ErrorState
          message={isNetworkError(query.error) ? es.meals.day.offlineLoad : es.meals.day.loadError}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.isSuccess ? (
        <>
          {entries.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="font-medium">{es.meals.day.empty}</p>
              <p className="text-muted">{es.meals.day.emptyHint}</p>
            </div>
          ) : (
            <section
              aria-label={es.meals.day.total}
              className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
            >
              <h2 className="text-lg font-semibold">{es.meals.day.total}</h2>
              <TotalsList totals={dayTotal} />
            </section>
          )}
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              date={date}
              entries={grouped[meal]}
              subtotal={subtotal(meal)}
              extra={
                <MealPhoto date={date} meal={meal} photo={photos?.find((p) => p.meal === meal)} />
              }
            />
          ))}
        </>
      ) : null}
    </div>
  )
}
