// Comidas del día y fechas (Principio VII: funciones puras). Las fechas del registro son texto
// AAAA-MM-DD: el día queda fijado al guardar y no se mueve con la zona horaria ni el horario de verano.
import { es } from '../../copy/es'

export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'extra'

/** Las cinco comidas, en el orden en que se muestran (FR-008). */
export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'snack', 'dinner', 'extra']

export const mealLabel = (meal: Meal): string => es.meals.names[meal]

export const isMeal = (value: string | null | undefined): value is Meal =>
  MEALS.includes(value as Meal)

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const FIRST_DAY = '2000-01-01'
const MAX_DAYS_AHEAD = 7

/** Devuelve la fecha si es real y tiene el formato AAAA-MM-DD; si no, `null`. */
export function parseDate(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return real ? text : null
}

function toUtc(date: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Suma días a una fecha con aritmética de calendario (sin horas: no la altera el horario de verano). */
export function addDays(date: string, days: number): string {
  const result = toUtc(date)
  result.setUTCDate(result.getUTCDate() + days)
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`
}

/** El día de calendario de `now` en una zona horaria; con una zona inválida, en UTC (FR-024). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  try {
    return format(timeZone)
  } catch {
    return format('UTC')
  }
}

/** "lunes 19 de octubre" */
export function formatDay(date: string): string {
  const utc = toUtc(date)
  return `${WEEKDAYS[utc.getUTCDay()]} ${utc.getUTCDate()} de ${MONTHS[utc.getUTCMonth()]}`
}

/** "lunes 19" */
export function formatDayShort(date: string): string {
  const utc = toUtc(date)
  return `${WEEKDAYS[utc.getUTCDay()]} ${utc.getUTCDate()}`
}

/** Desde el 1/1/2000 hasta 7 días después de hoy (FR-024, FR-027). */
export function isDateInRange(date: string, today: string): boolean {
  return date >= FIRST_DAY && date <= addDays(today, MAX_DAYS_AHEAD)
}

/** Agrupa por comida: siempre las cinco, también las vacías, conservando el orden de entrada. */
export function groupByMeal<T extends { meal: Meal }>(entries: T[]): Record<Meal, T[]> {
  const grouped: Record<Meal, T[]> = { breakfast: [], lunch: [], snack: [], dinner: [], extra: [] }
  for (const entry of entries) grouped[entry.meal].push(entry)
  return grouped
}
