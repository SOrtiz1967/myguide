import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { formatValue } from '../foods/nutrition'
import { useGoalHistory } from '../goals/useGoalHistory'
import { buildNutritionWeeks, proteinPerKg, type NutritionWeek } from './nutrition'
import { useNutritionDays, useWeightUpTo } from './useTrends'
import type { Week } from './weeks'

const copy = es.trends
const n = copy.nutrition

const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const perKg = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
const kg = (value: number) => `${decimal.format(value)} kg`
const kcal = (value: number) => formatValue(Math.round(value), 'kcal')
const grams = (value: number) => formatValue(Math.round(value * 10) / 10, 'g')

function goalText(week: NutritionWeek): string {
  const low = week.goals[0]
  const high = week.goals[week.goals.length - 1]
  if (low === undefined || high === undefined) return n.noGoal
  return n.goal(low === high ? kcal(low) : n.goalBetween(kcal(low), kcal(high)))
}

function WeekRow({ row, max }: { row: NutritionWeek; max: number }) {
  const { week, averages } = row
  const energy = averages.energy_kcal.value
  return (
    <li className="card-inset flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="break-words">
          {copy.weekLabel(formatDate(week.start), formatDate(week.end))}
          {week.current ? ` (${copy.currentWeek})` : ''}
        </span>
        <span className="font-semibold">
          {energy === null ? copy.noData : n.energy(kcal(energy))}
        </span>
      </div>
      <div aria-hidden="true" className="h-2 rounded-full bg-surface-3">
        <div
          className="h-2 rounded-full bg-mark"
          style={{ width: energy === null ? '0%' : `${(energy / max) * 100}%` }}
        />
      </div>
      <p className="text-sm">
        {row.recordedDays === 0 ? n.noRecord : n.recordedDays(row.recordedDays)}
      </p>
      {row.recordedDays > 0 ? (
        <>
          <p className="text-sm text-muted">{goalText(row)}</p>
          {row.daysWithGoal > 0 ? (
            <p className="text-sm">{n.inRange(row.daysInRange, row.daysWithGoal)}</p>
          ) : null}
          <ul className="text-sm text-muted">
            {(['protein_g', 'carbs_g', 'fat_g'] as const).map((key) => {
              const average = averages[key]
              return (
                <li key={key}>
                  {average.value === null
                    ? `${n.macros[key]}: ${copy.noData.toLowerCase()}`
                    : n.macroLine(
                        n.macros[key],
                        grams(average.value),
                        average.days,
                        row.recordedDays,
                      )}
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </li>
  )
}

function ProteinBlock({ to, days }: { to: string; days: Parameters<typeof proteinPerKg>[0] }) {
  const weight = useWeightUpTo(to)
  if (weight.isPending) return <LoadingState />
  if (weight.isError) {
    return (
      <ErrorState
        message={isNetworkError(weight.error) ? copy.offline : copy.loadError}
        onRetry={() => void weight.refetch()}
      />
    )
  }
  const result = proteinPerKg(days, weight.data ? [weight.data] : [], to)
  return (
    <div className="card-inset flex flex-col gap-1 px-4 py-3">
      <h3 className="font-semibold">{n.protein.title}</h3>
      {result.value !== null && result.protein.value !== null && result.weight ? (
        <>
          <p className="text-lg font-semibold">{n.protein.value(perKg.format(result.value))}</p>
          <p className="text-sm text-muted">
            {n.protein.detail(
              grams(result.protein.value),
              result.protein.days,
              kg(result.weight.value),
              formatDate(result.weight.date),
            )}
          </p>
        </>
      ) : result.weight === null ? (
        <p>
          {n.protein.noWeight}{' '}
          <Link to="/medidas" className="underline">
            {n.protein.addWeight}
          </Link>
        </p>
      ) : (
        <p>{n.protein.noProtein}</p>
      )}
    </div>
  )
}

/**
 * Alimentación por semana (spec 010, FR-004 a FR-010): promedios de los días con registro, objetivo de esos días, conteo
 * de días dentro de ±10 % y proteína por kilo. Cada fila dice todo en texto (la barra es solo un apoyo visual).
 */
export function NutritionSection({ weeks, from, to }: { weeks: Week[]; from: string; to: string }) {
  const days = useNutritionDays(from, to)
  const goals = useGoalHistory()

  const rows = days.data && goals.data ? buildNutritionWeeks(days.data, weeks, goals.data) : []
  const max = Math.max(
    1,
    ...rows.map((row) => row.averages.energy_kcal.value ?? 0),
    ...rows.flatMap((row) => row.goals),
  )

  return (
    <section aria-labelledby="tendencias-alimentacion" className="card flex flex-col gap-4">
      <div>
        <h2 id="tendencias-alimentacion" className="text-lg font-bold">
          {n.title}
        </h2>
        <p className="text-sm text-muted">{n.intro}</p>
      </div>

      {days.isPending || goals.isPending ? <LoadingState /> : null}
      {days.isError || goals.isError ? (
        <ErrorState
          message={isNetworkError(days.error ?? goals.error) ? copy.offline : copy.loadError}
          onRetry={() => {
            void days.refetch()
            void goals.refetch()
          }}
        />
      ) : null}
      {days.isSuccess && goals.isSuccess && days.data.length === 0 ? (
        <EmptyState title={n.empty} description={n.emptyBody} />
      ) : null}
      {days.isSuccess && goals.isSuccess && days.data.length > 0 ? (
        <>
          <ProteinBlock to={to} days={days.data} />
          <ul aria-label={n.listLabel} className="flex flex-col gap-2">
            {[...rows].reverse().map((row) => (
              <WeekRow key={row.week.start} row={row} max={max} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
