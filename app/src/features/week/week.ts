import { addDays } from '../meals/meals'
import type { SessionStatus } from '../training/trainingText'

// Estados de la semana (spec 016). Describen, no juzgan: «En rango» es una referencia orientativa de ±10 %
// del objetivo del día, y un día pasado de rango no es un fallo (Principio IV).

/** Tolerancia alrededor del objetivo del día para decir «en rango». */
export const TOLERANCE = 0.1

export type CalorieState =
  'no-goal' | 'future' | 'no-record' | 'in-progress' | 'below' | 'in-range' | 'above'

export type TrainingState = 'in-progress' | 'done' | 'planned' | 'unlogged' | 'cancelled' | 'none'

const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

/** Posición del día en la semana que empieza el lunes: lunes 0 … domingo 6. */
export const weekdayIndex = (date: string): number => (toUtc(date).getUTCDay() + 6) % 7

/** Los siete días (lunes a domingo) de la semana que contiene `anchor`. */
export function weekDays(anchor: string): string[] {
  const monday = addDays(anchor, -weekdayIndex(anchor))
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

interface CalorieInput {
  date: string
  today: string
  goal: number | null
  /** Kilocalorías registradas ese día (0 si no hay ítems). */
  registered: number
  /** Cantidad de ítems registrados ese día. */
  entries: number
}

/**
 * El estado de calorías de un día. Sin objetivo no hay estado; sin ítems es «Sin registro» (que no es
 * «Por debajo»); hoy se muestra «En curso» sin juzgarlo hasta que termina el día.
 */
export function calorieState({
  date,
  today,
  goal,
  registered,
  entries,
}: CalorieInput): CalorieState {
  if (date > today) return 'future'
  if (goal === null) return 'no-goal'
  if (entries === 0) return 'no-record'
  if (date === today) return 'in-progress'
  const difference = registered - goal
  if (Math.abs(difference) <= goal * TOLERANCE) return 'in-range'
  return difference < 0 ? 'below' : 'above'
}

/** El estado de entrenamiento de un día; con varias sesiones gana la más relevante. */
export function trainingState(
  sessions: ReadonlyArray<{ status: SessionStatus }>,
  date: string,
  today: string,
): TrainingState {
  if (sessions.some((s) => s.status === 'in_progress')) return 'in-progress'
  if (sessions.some((s) => s.status === 'completed')) return 'done'
  if (sessions.some((s) => s.status === 'planned')) return date >= today ? 'planned' : 'unlogged'
  if (sessions.some((s) => s.status === 'cancelled')) return 'cancelled'
  return 'none'
}

/** Posición (0 a 1, desde abajo) de un valor en la barra del día; la escala llega a 1,5 veces el objetivo. */
export function barScale(goal: number, registered: number) {
  const max = Math.max(goal * 1.5, registered, 1)
  return {
    value: Math.min(registered / max, 1),
    low: (goal * (1 - TOLERANCE)) / max,
    high: (goal * (1 + TOLERANCE)) / max,
  }
}
