import { es } from '../../copy/es'
import { statusLabel, type SessionStatus } from './trainingText'

// Calendario de entrenamiento (spec 006, FR-021 a FR-027). Funciones puras sobre fechas «AAAA-MM-DD» en la zona de la
// persona; nunca pasan por `Date` local para no correr un día.

const c = es.training.calendar

export interface MonthRef {
  year: number
  /** 1 a 12. */
  month: number
}

export interface CalendarDay {
  date: string
  inMonth: boolean
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')
export const toDay = (year: number, month: number, day: number) =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}`

/** Una fecha «AAAA-MM-DD» real (rechaza el 31 de febrero y cualquier otro formato). */
export function isValidDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  )
}

export function monthOf(day: string): MonthRef {
  const [year, month] = day.split('-').map(Number)
  return { year: year!, month: month! }
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export const sameMonth = (a: MonthRef, b: MonthRef) => a.year === b.year && a.month === b.month

/** Suma días a una fecha. */
export function addDays(day: string, delta: number): string {
  const [year, month, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, d! + delta))
  return toDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** Día de la semana con el lunes en 0. */
function weekdayIndex(day: string): number {
  const [year, month, d] = day.split('-').map(Number)
  return (new Date(Date.UTC(year!, month! - 1, d)).getUTCDay() + 6) % 7
}

/** Las semanas del mes, de lunes a domingo, completadas con días del mes anterior y del siguiente. */
export function monthGrid({ year, month }: MonthRef): CalendarDay[][] {
  const first = toDay(year, month, 1)
  const start = addDays(first, -weekdayIndex(first))
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = toDay(year, month, length)
  const end = addDays(last, 6 - weekdayIndex(last))
  const weeks: CalendarDay[][] = []
  let cursor = start
  while (cursor <= end) {
    const week: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: monthOf(cursor).month === month })
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }
  return weeks
}

/** El rango de fechas que cubre la cuadrícula del mes (incluye los días de las semanas vecinas). */
export function gridRange(month: MonthRef): { from: string; to: string } {
  const weeks = monthGrid(month)
  return { from: weeks[0]![0]!.date, to: weeks[weeks.length - 1]![6]!.date }
}

export const monthTitle = ({ year, month }: MonthRef) => c.monthTitle(c.months[month - 1]!, year)

/** «jueves 22 de octubre». */
export function dayName(day: string): string {
  const [, month, d] = day.split('-').map(Number)
  return c.dayName(c.weekdays[weekdayIndex(day)]!, d!, c.months[month! - 1]!)
}

export type DayState = 'completed' | 'in_progress' | 'planned' | 'unrecorded' | 'cancelled'

/** Una planificada con fecha pasada es «sin registrar» (texto neutral, FR-026). */
export function sessionState(
  session: { status: SessionStatus; session_date: string },
  today: string,
): DayState {
  if (session.status === 'planned' && session.session_date < today) return 'unrecorded'
  return session.status
}

const ORDER: DayState[] = ['completed', 'in_progress', 'planned', 'unrecorded', 'cancelled']

/** Cuántas sesiones hay de cada estado, en un orden fijo y solo los estados presentes. */
export function dayCounts(
  sessions: Array<{ status: SessionStatus; session_date: string }>,
  today: string,
): Array<{ state: DayState; count: number }> {
  const counts = new Map<DayState, number>()
  for (const session of sessions) {
    const state = sessionState(session, today)
    counts.set(state, (counts.get(state) ?? 0) + 1)
  }
  return ORDER.filter((state) => counts.has(state)).map((state) => ({
    state,
    count: counts.get(state)!,
  }))
}

/** Nombre accesible de un día: «jueves 22 de octubre: 1 sesión realizada, 1 planificada». */
export function dayLabel(
  day: string,
  sessions: Array<{ status: SessionStatus; session_date: string }>,
  today: string,
): string {
  const parts = dayCounts(sessions, today).map(({ state, count }) => c.count[state](count))
  return `${dayName(day)}: ${parts.length > 0 ? parts.join(', ') : c.noSessions}`
}

/** El estado de una sesión con palabras: «Sin registrar» para una planificada que quedó atrás. */
export function sessionStateLabel(
  session: { status: SessionStatus; session_date: string },
  today: string,
): string {
  return sessionState(session, today) === 'unrecorded'
    ? es.training.overdue
    : statusLabel(session.status)
}
