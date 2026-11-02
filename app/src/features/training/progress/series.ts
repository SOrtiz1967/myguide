// Spec 012 (FR-005, FR-007, FR-010 a FR-012, FR-015): de las series crudas a los puntos del gráfico y a la comparación.
import { computeMeasure, type MeasureKey, type SetData } from './measures'
import { inRange, type DateRange } from './periods'

/** Una fila de `exercise_progress`: un ejercicio dentro de una sesión realizada. */
export interface ProgressRow {
  session_id: string
  session_date: string
  exercise_name: string
  measurement_type: string
  effort: number | null
  sets: SetData[]
}

export interface ProgressPoint {
  /** Único por fila: dos veces el mismo ejercicio el mismo día son dos puntos. */
  key: string
  date: string
  value: number
  /** Esfuerzo percibido (1 a 10) o `null` si no se indicó. */
  effort: number | null
  usedSets: number
  excludedSets: number
  name: string
}

export interface NoDataSession {
  key: string
  date: string
  excludedSets: number
}

export interface ProgressSeries {
  points: ProgressPoint[]
  /** Sesiones del período sin ningún dato utilizable para la medida: no se grafican, y no son cero. */
  noData: NoDataSession[]
  /** Sesiones realizadas del período en las que se registró el ejercicio. */
  sessions: number
  /** Series excluidas por no tener el dato que la medida necesita. */
  excludedSets: number
  /** Con menos de 3 sesiones con dato no se une una línea ni se habla de evolución (Principio V). */
  showTrend: boolean
}

export const MIN_TREND_SESSIONS = 3
export const MIN_COMPARE_SESSIONS = 2

const rowKey = (row: ProgressRow, index: number) => `${row.session_id}:${index}`

export function buildProgressSeries(
  rows: ProgressRow[],
  measure: MeasureKey,
  range: DateRange,
): ProgressSeries {
  const points: ProgressPoint[] = []
  const noData: NoDataSession[] = []
  let sessions = 0
  let excludedSets = 0

  rows.forEach((row, index) => {
    if (!inRange(row.session_date, range)) return
    sessions++
    const result = computeMeasure(measure, row.sets)
    excludedSets += result.excluded
    const key = rowKey(row, index)
    if (result.value === null) {
      noData.push({ key, date: row.session_date, excludedSets: result.excluded })
      return
    }
    points.push({
      key,
      date: row.session_date,
      value: result.value,
      effort: row.effort,
      usedSets: result.used,
      excludedSets: result.excluded,
      name: row.exercise_name,
    })
  })

  return { points, noData, sessions, excludedSets, showTrend: points.length >= MIN_TREND_SESSIONS }
}

export interface PeriodSummary {
  range: DateRange
  /** Sesiones con dato en el período. */
  sessions: number
  /** Promedio por sesión de la medida, o `null` si no hay datos. */
  average: number | null
  /** Hay datos suficientes (al menos 2 sesiones) para compararlo. */
  enough: boolean
}

export interface Comparison {
  current: PeriodSummary
  previous: PeriodSummary
  /** `actual − anterior`; `null` si alguno de los dos períodos no tiene datos suficientes. */
  difference: number | null
}

function summarize(rows: ProgressRow[], measure: MeasureKey, range: DateRange): PeriodSummary {
  const { points } = buildProgressSeries(rows, measure, range)
  const sessions = points.length
  const average =
    sessions === 0
      ? null
      : Math.round((points.reduce((total, p) => total + p.value, 0) / sessions) * 100) / 100
  return { range, sessions, average, enough: sessions >= MIN_COMPARE_SESSIONS }
}

/**
 * Compara dos períodos del mismo largo con el promedio por sesión de la medida. La diferencia es un número sin
 * calificar; con menos de 2 sesiones con dato en alguno de los dos no se calcula.
 */
export function compareRanges(
  rows: ProgressRow[],
  measure: MeasureKey,
  currentRange: DateRange,
  previousRange: DateRange,
): Comparison {
  const current = summarize(rows, measure, currentRange)
  const previous = summarize(rows, measure, previousRange)
  const difference =
    current.enough && previous.enough
      ? Math.round((current.average! - previous.average!) * 100) / 100
      : null
  return { current, previous, difference }
}
