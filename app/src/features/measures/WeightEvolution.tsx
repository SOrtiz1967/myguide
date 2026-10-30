import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { useToday } from '../meals/useToday'
import { fetchWeightsBetween } from './api'
import { useFastingFilter } from './useFastingFilter'
import { measuresKey } from './useMeasures'
import { WeightChart } from './WeightChart'
import {
  addDaysTo,
  AVERAGE_WINDOW_DAYS,
  buildSeries,
  DEFAULT_PERIOD,
  PERIODS,
  periodStart,
  weightStats,
  type Period,
} from './weightSeries'

const copy = es.measures.evolution
const kg = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const withKg = (value: number) => `${kg.format(value)} kg`
const FIRST_DAY = '2000-01-01'

/**
 * «Evolución del peso» (spec 020): el gráfico del período elegido, el filtro de ayunas y las cifras. Solo describe los
 * datos: no hay metas, cambios ni conclusiones, y con pocos registros no se muestra promedio (Principios IV y V).
 */
export function WeightEvolution() {
  const today = useToday()
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  const [fastingOnly, setFastingOnly] = useFastingFilter()
  const from = periodStart(period, today)

  // Se piden 6 días de más antes del inicio para que el primer día del período tenga su ventana completa.
  const query = useQuery({
    queryKey: [...measuresKey, 'weights', from, today],
    queryFn: async () => {
      const rows = await fetchWeightsBetween(
        from ? addDaysTo(from, -(AVERAGE_WINDOW_DAYS - 1)) : FIRST_DAY,
        today,
      )
      return rows.map((row) => ({ date: row.measured_on, value: row.value, fasting: row.fasting }))
    },
    placeholderData: keepPreviousData,
  })

  const weights = query.data ?? []
  const { points, excluded } = buildSeries(weights, from, fastingOnly)
  const stats = weightStats(points)
  const axisFrom = from ?? points[0]?.date ?? today
  const hasOlder = weights.length > 0 && from !== null && weights.every((w) => w.date < from)
  const anyFasting = weights.some((w) => w.fasting)
  const hasGap = points.length >= 2 && points.some((p) => p.avg === null)

  return (
    <section aria-labelledby="evolucion-peso" className="card flex flex-col gap-4">
      <div>
        <h2 id="evolucion-peso" className="text-lg font-extrabold">
          {copy.title}
        </h2>
        <p className="text-sm text-muted">{copy.intro}</p>
      </div>

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
              {copy.periods[value]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              className="chip"
              aria-pressed={fastingOnly === value}
              onClick={() => setFastingOnly(value)}
            >
              {value ? copy.filter.fasting : copy.filter.all}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? <LoadingState label={copy.loading} /> : null}
      {query.isError ? (
        <ErrorState message={copy.loadError} onRetry={() => void query.refetch()} />
      ) : null}

      {query.isSuccess && points.length === 0 ? (
        <div className="card-inset flex flex-col gap-1">
          <p className="font-bold">{copy.emptyTitle}</p>
          <p className="text-muted">{copy.emptyBody}</p>
          {hasOlder && !fastingOnly ? <p className="text-muted">{copy.emptyOlder}</p> : null}
          {fastingOnly && weights.length > 0 && !anyFasting ? (
            <p className="text-muted">{copy.emptyFasting}</p>
          ) : null}
        </div>
      ) : null}

      {points.length > 0 ? (
        <>
          <WeightChart points={points} from={axisFrom} to={today} stale={query.isPlaceholderData} />
          <ul className="flex flex-col gap-1 text-sm text-muted">
            <li>{copy.axisNote}</li>
            {points.length === 1 ? <li>{copy.oneRecord}</li> : null}
            {hasGap ? <li>{copy.fewRecords}</li> : null}
            {fastingOnly && excluded > 0 ? <li>{copy.excluded(excluded)}</li> : null}
          </ul>
        </>
      ) : null}

      {stats ? (
        <section aria-labelledby="cifras-peso" className="flex flex-col gap-2">
          <h3 id="cifras-peso" className="text-base font-bold">
            {copy.stats.title}
          </h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Figure label={copy.stats.count} value={String(stats.count)} />
            <Figure
              label={copy.stats.last}
              value={copy.stats.on(withKg(stats.last.value), formatDate(stats.last.date))}
            />
            <Figure
              label={copy.stats.average}
              value={stats.lastAverage === null ? copy.stats.noAverage : withKg(stats.lastAverage)}
            />
            <Figure
              label={copy.stats.min}
              value={copy.stats.on(withKg(stats.min.value), formatDate(stats.min.date))}
            />
            <Figure
              label={copy.stats.max}
              value={copy.stats.on(withKg(stats.max.value), formatDate(stats.max.date))}
            />
          </dl>
        </section>
      ) : null}
    </section>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-inset flex flex-col gap-0.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}
