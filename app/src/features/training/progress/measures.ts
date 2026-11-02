// Spec 012 (FR-003 a FR-005): las medidas que resumen una sesión de un ejercicio, según su tipo de medición.
// Funciones puras: se prueban contra valores calculados a mano. Un dato que falta nunca cuenta como cero.

export type MeasurementType = 'reps_weight' | 'reps_bodyweight' | 'duration' | 'distance_duration'

export type MeasureKey =
  | 'max_weight'
  | 'volume'
  | 'total_reps'
  | 'max_reps'
  | 'total_time'
  | 'longest_set'
  | 'total_distance'

export type Unit = 'kg' | 'reps' | 's' | 'km'

/** Una serie tal como la entrega `exercise_progress`: los datos que faltan no están. */
export interface SetData {
  reps?: number
  weight_kg?: number
  duration_s?: number
  distance_km?: number
}

/** Las medidas de cada tipo de medición, en el orden en que se ofrecen (la primera es la inicial). */
export const MEASURES_BY_TYPE: Record<MeasurementType, MeasureKey[]> = {
  reps_weight: ['max_weight', 'volume', 'total_reps'],
  reps_bodyweight: ['total_reps', 'max_reps'],
  duration: ['total_time', 'longest_set'],
  distance_duration: ['total_distance', 'total_time'],
}

export const UNIT_OF: Record<MeasureKey, Unit> = {
  max_weight: 'kg',
  volume: 'kg',
  total_reps: 'reps',
  max_reps: 'reps',
  total_time: 's',
  longest_set: 's',
  total_distance: 'km',
}

export function isMeasurementType(value: string): value is MeasurementType {
  return value in MEASURES_BY_TYPE
}

export interface MeasureResult {
  /** `null` si ninguna serie tiene el dato que la medida necesita («sin dato», nunca cero). */
  value: number | null
  /** Series que aportaron al valor. */
  used: number
  /** Series que quedaron fuera por no tener el dato. */
  excluded: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

function pick(sets: SetData[], need: (set: SetData) => number | null): number[] {
  const values: number[] = []
  for (const set of sets) {
    const value = need(set)
    if (value !== null) values.push(value)
  }
  return values
}

const has = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Calcula una medida sobre las series de una sesión. */
export function computeMeasure(measure: MeasureKey, sets: SetData[]): MeasureResult {
  let values: number[]
  let aggregate: 'sum' | 'max'
  switch (measure) {
    case 'max_weight':
      values = pick(sets, (s) => (has(s.weight_kg) ? s.weight_kg : null))
      aggregate = 'max'
      break
    case 'volume':
      values = pick(sets, (s) => (has(s.reps) && has(s.weight_kg) ? s.reps * s.weight_kg : null))
      aggregate = 'sum'
      break
    case 'total_reps':
      values = pick(sets, (s) => (has(s.reps) ? s.reps : null))
      aggregate = 'sum'
      break
    case 'max_reps':
      values = pick(sets, (s) => (has(s.reps) ? s.reps : null))
      aggregate = 'max'
      break
    case 'total_time':
      values = pick(sets, (s) => (has(s.duration_s) ? s.duration_s : null))
      aggregate = 'sum'
      break
    case 'longest_set':
      values = pick(sets, (s) => (has(s.duration_s) ? s.duration_s : null))
      aggregate = 'max'
      break
    case 'total_distance':
      values = pick(sets, (s) => (has(s.distance_km) ? s.distance_km : null))
      aggregate = 'sum'
      break
  }
  const used = values.length
  const excluded = sets.length - used
  if (used === 0) return { value: null, used, excluded }
  const value =
    aggregate === 'sum' ? values.reduce((total, v) => total + v, 0) : Math.max(...values)
  return { value: round2(value), used, excluded }
}

const decimal = (value: number, max = 2) =>
  value.toLocaleString('es-AR', { maximumFractionDigits: max })

/** Duración legible: «45 s», «12 min 30 s», «1 h 5 min». */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`
  return `${s} s`
}

/** Un valor con su unidad, con el formato regional (coma decimal). */
export function formatMeasure(value: number, unit: Unit): string {
  switch (unit) {
    case 'kg':
      return `${decimal(value, 1)} kg`
    case 'km':
      return `${decimal(value, 2)} km`
    case 'reps':
      return `${decimal(value, 0)} ${value === 1 ? 'repetición' : 'repeticiones'}`
    case 's':
      return formatDuration(value)
  }
}

/** Una diferencia con signo explícito y su unidad, sin calificarla. */
export function formatDifference(value: number, unit: Unit): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const absolute = Math.abs(value)
  if (unit === 's') return `${sign}${formatDuration(absolute)}`
  return `${sign}${formatMeasure(absolute, unit)}`
}
