// Spec 020: cálculo de la evolución del peso. Funciones puras: período, filtro de ayunas, promedio de 7 días, cifras y eje.

export const PERIODS = ['30d', '90d', '6m', '1y', 'all'] as const
export type Period = (typeof PERIODS)[number]
export const DEFAULT_PERIOD: Period = '90d'

/** Días de calendario de la ventana del promedio y mínimo de registros para mostrarlo (Principio V). */
export const AVERAGE_WINDOW_DAYS = 7
export const AVERAGE_MIN_RECORDS = 3

export interface WeightPoint {
  date: string
  value: number
  fasting: boolean
}

export interface SeriesPoint extends WeightPoint {
  /** Promedio de los registros de los 7 días que terminan en `date`; nulo si hay menos de 3. */
  avg: number | null
}

const DAY_MS = 86_400_000
const toDay = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
const fromDay = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10)

export const addDaysTo = (date: string, days: number): string => fromDay(toDay(date) + days)
export const daysBetween = (a: string, b: string): number => Math.abs(toDay(a) - toDay(b))

/** Primer día del período (incluido) para un `today`; nulo si es «Todo». */
export function periodStart(period: Period, today: string): string | null {
  switch (period) {
    case '30d':
      return addDaysTo(today, -29)
    case '90d':
      return addDaysTo(today, -89)
    case '6m':
      return shiftMonths(today, -6)
    case '1y':
      return shiftMonths(today, -12)
    default:
      return null
  }
}

function shiftMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target.toISOString().slice(0, 10)
}

/**
 * Los puntos del período con su promedio de 7 días. `weights` va del más antiguo al más reciente y puede incluir los 6
 * días anteriores al inicio (para que el primer día del período tenga su ventana completa). Con `fastingOnly` solo
 * cuentan los marcados en ayunas. `excluded` es la cantidad de registros del período que quedaron fuera por eso.
 */
export function buildSeries(
  weights: WeightPoint[],
  from: string | null,
  fastingOnly: boolean,
): { points: SeriesPoint[]; excluded: number } {
  const inPeriod = (p: WeightPoint) => from === null || p.date >= from
  const used = fastingOnly ? weights.filter((p) => p.fasting) : weights
  const excluded = fastingOnly ? weights.filter((p) => inPeriod(p) && !p.fasting).length : 0

  const points: SeriesPoint[] = []
  used.forEach((point, index) => {
    if (!inPeriod(point)) return
    const windowStart = toDay(point.date) - (AVERAGE_WINDOW_DAYS - 1)
    let sum = 0
    let count = 0
    for (let i = index; i >= 0; i--) {
      const candidate = used[i]!
      if (toDay(candidate.date) < windowStart) break
      sum += candidate.value
      count++
    }
    points.push({ ...point, avg: count >= AVERAGE_MIN_RECORDS ? sum / count : null })
  })
  return { points, excluded }
}

/** Tramos continuos de la línea del promedio: se corta si entre dos puntos con promedio pasan más de 7 días. */
export function averageSegments(points: SeriesPoint[]): { date: string; avg: number }[][] {
  const segments: { date: string; avg: number }[][] = []
  let current: { date: string; avg: number }[] = []
  let previous: string | null = null
  for (const point of points) {
    if (point.avg === null) continue
    if (previous !== null && daysBetween(previous, point.date) > AVERAGE_WINDOW_DAYS) {
      segments.push(current)
      current = []
    }
    current.push({ date: point.date, avg: point.avg })
    previous = point.date
  }
  if (current.length > 0) segments.push(current)
  return segments
}

export interface WeightStats {
  count: number
  last: WeightPoint
  /** El promedio de 7 días del último registro, o nulo. */
  lastAverage: number | null
  min: WeightPoint
  max: WeightPoint
}

/** Cifras descriptivas del período; nulo si no hay registros. Con empate en el mínimo o el máximo, el más antiguo. */
export function weightStats(points: SeriesPoint[]): WeightStats | null {
  const last = points[points.length - 1]
  if (!last) return null
  let min = points[0]!
  let max = points[0]!
  for (const point of points) {
    if (point.value < min.value) min = point
    if (point.value > max.value) max = point
  }
  return { count: points.length, last, lastAverage: last.avg, min, max }
}

/** Eje vertical: el rango de los datos con un margen del 10 % (al menos 0,5 kg), sin forzar el cero. */
export function yDomain(points: SeriesPoint[]): { min: number; max: number } {
  const values = points.flatMap((p) => (p.avg === null ? [p.value] : [p.value, p.avg]))
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max((high - low) * 0.1, 0.5)
  return { min: low - pad, max: high + pad }
}

/** Marcas «redondas» del eje dentro de [min, max], unas `target`. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  const rough = (max - min) / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough) ?? 10) * magnitude
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    ticks.push(Math.round(v * 1000) / 1000)
  }
  return ticks
}

/** Fechas del eje horizontal: `count` marcas parejas entre dos fechas (ambas incluidas). */
export function dateTicks(from: string, to: string, count = 4): string[] {
  const a = toDay(from)
  const b = toDay(to)
  if (b <= a) return [from]
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(fromDay(Math.round(a + ((b - a) * i) / (count - 1))))
  return out
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «12 oct», o «12 oct 26» cuando se muestra más de un año. */
export function shortDate(date: string, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${String(y).slice(2)}` : ''}`
}

/** Posición horizontal de una fecha entre dos extremos, de 0 a 1. */
export function xRatio(date: string, from: string, to: string): number {
  const span = toDay(to) - toDay(from)
  return span <= 0 ? 0.5 : (toDay(date) - toDay(from)) / span
}
