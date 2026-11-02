// Spec 010 (FR-002, FR-010): períodos y semanas de Tendencias. Las semanas van de lunes a domingo, como el plan semanal.
import { addDaysTo } from '../measures/weightSeries'
import { weekStart } from '../training/progress/activity'

export const PERIODS = ['4w', '12w', '6m', '1y'] as const
export type Period = (typeof PERIODS)[number]
export const DEFAULT_PERIOD: Period = '12w'

/** Cuántas semanas completas (la última es la en curso) muestra cada período. */
export const WEEKS_IN: Record<Period, number> = { '4w': 4, '12w': 12, '6m': 26, '1y': 52 }

export interface Week {
  /** El lunes. */
  start: string
  /** El domingo. */
  end: string
  /** La semana de hoy: todavía le faltan días. */
  current: boolean
}

/** Las semanas del período, de la más antigua a la en curso. */
export function periodWeeks(period: Period, today: string): Week[] {
  const last = weekStart(today)
  const count = WEEKS_IN[period]
  return Array.from({ length: count }, (_, index) => {
    const start = addDaysTo(last, -7 * (count - 1 - index))
    return { start, end: addDaysTo(start, 6), current: start === last }
  })
}

/** El primer lunes del período y hoy: el rango que se pide al servidor. */
export function periodRange(period: Period, today: string): { from: string; to: string } {
  return { from: periodWeeks(period, today)[0]!.start, to: today }
}

/** La semana (de las dadas) que contiene un día, o `undefined` si el día queda fuera. */
export function weekOf(weeks: readonly Week[], date: string): Week | undefined {
  return weeks.find((week) => date >= week.start && date <= week.end)
}
