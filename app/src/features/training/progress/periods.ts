// Spec 012 (FR-006, FR-010): períodos de los gráficos. Los días son los de la persona (`session_date` ya es local).
import { addDaysTo } from '../../measures/weightSeries'

export const PERIODS = ['4w', '12w', '6m', '1y', 'all'] as const
export type Period = (typeof PERIODS)[number]
export const DEFAULT_PERIOD: Period = '12w'

const DAYS: Record<Exclude<Period, 'all'>, number> = { '4w': 28, '12w': 84, '6m': 182, '1y': 365 }

export interface DateRange {
  /** Primer día incluido; `null` = desde el principio. */
  from: string | null
  /** Último día incluido. */
  to: string
}

/** El período que termina hoy: de `today - (días - 1)` a `today`, así «4 semanas» son exactamente 28 días. */
export function periodRange(period: Period, today: string): DateRange {
  if (period === 'all') return { from: null, to: today }
  return { from: addDaysTo(today, -(DAYS[period] - 1)), to: today }
}

/** El período inmediatamente anterior y del mismo largo; no existe para «todo el historial». */
export function previousRange(period: Period, today: string): DateRange | null {
  if (period === 'all') return null
  const current = periodRange(period, today)
  const to = addDaysTo(current.from!, -1)
  return { from: addDaysTo(to, -(DAYS[period] - 1)), to }
}

export function inRange(date: string, range: DateRange): boolean {
  return (range.from === null || date >= range.from) && date <= range.to
}
