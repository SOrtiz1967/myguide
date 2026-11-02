import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { es } from '../../copy/es'
import { useToday } from '../meals/useToday'
import { MaintenanceSection } from './MaintenanceSection'
import { NutritionSection } from './NutritionSection'
import { TrainingSleepSection } from './TrainingSleepSection'
import { DEFAULT_PERIOD, PERIODS, periodRange, periodWeeks, type Period } from './weeks'

const copy = es.trends

/**
 * Tendencias (spec 010): alimentación por semana, mantenimiento estimado y entrenamiento junto al sueño. Solo describe los
 * datos que la persona registró: sin metas, puntajes ni conclusiones.
 */
export function TrendsPage() {
  const today = useToday()
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  const weeks = periodWeeks(period, today)
  const { from, to } = periodRange(period, today)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} subtitle={copy.intro} />

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

      <NutritionSection weeks={weeks} from={from} to={to} />
      <MaintenanceSection today={today} />
      <TrainingSleepSection weeks={weeks} from={from} to={to} />
    </div>
  )
}
