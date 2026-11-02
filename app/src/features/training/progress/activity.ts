// Spec 012 (FR-013, FR-014): sesiones realizadas por semana y por mes. Solo cuenta lo realizado; sin metas ni rachas.
import { addDaysTo } from '../../measures/weightSeries'
import { inRange, type DateRange } from './periods'

export interface Bucket {
  /** Primer día del tramo. */
  start: string
  /** Último día del tramo. */
  end: string
  count: number
}

export type Grouping = 'week' | 'month'

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

/** El lunes de la semana de un día (las semanas van de lunes a domingo, como el plan semanal). */
export function weekStart(date: string): string {
  const sinceMonday = (dayOfWeek(date) + 6) % 7
  return addDaysTo(date, -sinceMonday)
}

const monthStart = (date: string) => `${date.slice(0, 7)}-01`

function monthEnd(start: string): string {
  const [year, month] = start.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${start.slice(0, 8)}${String(last).padStart(2, '0')}`
}

function nextMonth(start: string): string {
  const [year, month] = start.split('-').map(Number) as [number, number]
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
}

/**
 * Cuenta las sesiones realizadas de cada tramo del período, con los tramos vacíos en cero. `dates` son los días de
 * las sesiones realizadas; `first` es el primer día con datos (para «todo el historial»).
 */
export function countSessions(
  dates: string[],
  range: DateRange,
  grouping: Grouping,
  first: string | null = null,
): Bucket[] {
  const from = range.from ?? first
  if (from === null) return []

  const buckets: Bucket[] = []
  if (grouping === 'week') {
    for (let start = weekStart(from); start <= range.to; start = addDaysTo(start, 7)) {
      buckets.push({ start, end: addDaysTo(start, 6), count: 0 })
    }
  } else {
    for (let start = monthStart(from); start <= range.to; start = nextMonth(start)) {
      buckets.push({ start, end: monthEnd(start), count: 0 })
    }
  }

  for (const date of dates) {
    if (!inRange(date, range)) continue
    const bucket = buckets.find((b) => date >= b.start && date <= b.end)
    if (bucket) bucket.count++
  }
  return buckets
}
