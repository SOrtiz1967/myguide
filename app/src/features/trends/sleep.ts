// Spec 010 (FR-020): sueño por semana. Una semana sin ninguna noche con dato es «sin dato», nunca cero horas.
import { weekOf, type Week } from './weeks'

/** Un registro de sueño (spec 007): minutos de una noche, en el día en que se registró. */
export interface SleepRecord {
  activity_date: string
  /** Minutos. */
  value: number
}

export interface SleepWeek {
  week: Week
  /** Noches con dato en la semana. */
  nights: number
  /** Promedio de minutos por noche; nulo si no hay datos. */
  averageMinutes: number | null
}

export function buildSleepWeeks(
  records: readonly SleepRecord[],
  weeks: readonly Week[],
): SleepWeek[] {
  return weeks.map((week) => {
    const inWeek = records.filter((record) => weekOf([week], record.activity_date) !== undefined)
    if (inWeek.length === 0) return { week, nights: 0, averageMinutes: null }
    const sum = inWeek.reduce((total, record) => total + record.value, 0)
    return { week, nights: inWeek.length, averageMinutes: sum / inWeek.length }
  })
}
