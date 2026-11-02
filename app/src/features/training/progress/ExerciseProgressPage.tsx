import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { LoadingState } from '../../../components/LoadingState'
import { es } from '../../../copy/es'
import { formatDate } from '../../../lib/format'
import { isNetworkError } from '../../../lib/errors'
import { useExercise } from '../../exercises/useExercise'
import { useToday } from '../../meals/useToday'
import { ComparePanel } from './ComparePanel'
import { isMeasurementType, MEASURES_BY_TYPE, UNIT_OF, type MeasureKey } from './measures'
import { DEFAULT_PERIOD, PERIODS, periodRange, previousRange, type Period } from './periods'
import { ProgressChart } from './ProgressChart'
import { buildProgressSeries, compareRanges } from './series'
import { useExerciseProgress } from './useProgress'

const copy = es.trainingProgress

/**
 * La evolución de un ejercicio (spec 012): un punto por sesión realizada, con la medida y el período que la persona
 * elige. Solo describe los datos: sin récords, metas ni valoraciones, y con pocas sesiones no se une ninguna línea.
 */
export function ExerciseProgressPage() {
  const { id = '' } = useParams()
  const exercise = useExercise(id)
  const progress = useExerciseProgress(id)
  const today = useToday()
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  const [chosen, setChosen] = useState<MeasureKey | null>(null)
  const [comparing, setComparing] = useState(false)

  const rows = progress.data ?? []
  // El tipo y el nombre son los de la última sesión: cada sesión guardó los suyos.
  const latest = rows.at(-1)
  const type = latest && isMeasurementType(latest.measurement_type) ? latest.measurement_type : null
  const measures = type ? MEASURES_BY_TYPE[type] : []
  const measure: MeasureKey | null =
    chosen && measures.includes(chosen) ? chosen : (measures[0] ?? null)
  const unit = measure ? UNIT_OF[measure] : null

  const range = periodRange(period, today)
  const series = measure ? buildProgressSeries(rows, measure, range) : null
  const first = rows[0]?.session_date ?? today
  const axisFrom = range.from ?? series?.points[0]?.date ?? first
  const previous = previousRange(period, today)
  const comparison = measure && previous ? compareRanges(rows, measure, range, previous) : null
  const name = latest?.exercise_name ?? exercise.data?.name

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to={`/ejercicios/${id}/historia`}
          className="inline-flex min-h-11 items-center underline"
        >
          {copy.back}
        </Link>
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{copy.title}</h1>
        {name ? <p className="break-words text-muted">{name}</p> : null}
      </header>

      {progress.isPending ? <LoadingState /> : null}
      {progress.isError ? (
        <ErrorState
          message={isNetworkError(progress.error) ? copy.offline : copy.loadError}
          onRetry={() => void progress.refetch()}
        />
      ) : null}
      {progress.isSuccess && rows.length === 0 ? (
        <EmptyState title={copy.empty} description={copy.emptyBody} />
      ) : null}

      {progress.isSuccess && rows.length > 0 && measure && unit && series ? (
        <section aria-labelledby="evolucion-titulo" className="card flex flex-col gap-4">
          <h2 id="evolucion-titulo" className="sr-only">
            {copy.title}
          </h2>

          <div className="flex flex-col gap-3">
            <div role="group" aria-label={copy.measureLabel} className="flex flex-wrap gap-2">
              {measures.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={measure === value}
                  onClick={() => setChosen(value)}
                >
                  {copy.measures[value]}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">{copy.howCalculated[measure]}</p>
            <div role="group" aria-label={copy.periodLabel} className="flex flex-wrap gap-2">
              {PERIODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {copy.periods[value]}
                </button>
              ))}
            </div>
          </div>

          <p className="font-semibold">
            {range.from
              ? copy.summary(series.sessions, formatDate(range.from), formatDate(range.to))
              : copy.summaryAll(series.sessions)}
          </p>

          {series.sessions === 0 ? (
            <p role="status" className="card-inset px-4 py-3">
              {copy.emptyPeriod}
            </p>
          ) : null}

          {series.points.length > 0 ? (
            <ProgressChart
              points={series.points}
              unit={unit}
              showTrend={series.showTrend}
              from={axisFrom}
              to={today}
            />
          ) : null}

          {series.points.length > 0 && !series.showTrend ? (
            <p role="status" className="card-inset px-4 py-3">
              {copy.notEnough}
            </p>
          ) : null}
          {series.excludedSets > 0 ? (
            <p role="status" className="text-sm text-muted">
              {copy.excluded(series.excludedSets)}
            </p>
          ) : null}
          {series.noData.length > 0 ? (
            <div className="card-inset flex flex-col gap-1 px-4 py-3 text-sm">
              <p className="font-semibold">{copy.noDataTitle}</p>
              <ul className="list-disc pl-5">
                {series.noData.map((item) => (
                  <li key={item.key}>
                    {formatDate(item.date)}: {copy.noData.toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            {comparison ? (
              <button
                type="button"
                className="btn-secondary"
                aria-expanded={comparing}
                onClick={() => setComparing((value) => !value)}
              >
                {copy.compare.title}
              </button>
            ) : (
              <p className="text-sm text-muted">{copy.compare.unavailable}</p>
            )}
          </div>
          {comparing && comparison ? <ComparePanel comparison={comparison} unit={unit} /> : null}
        </section>
      ) : null}
    </div>
  )
}
