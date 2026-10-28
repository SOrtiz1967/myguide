import { useQuery } from '@tanstack/react-query'
import { weekdayIndex } from '../week/week'
import { fetchWeeklyPlan, type WeeklyPlanDay } from './api'

export const weeklyPlanQueryKey = ['training', 'plan'] as const

export function useWeeklyPlan() {
  return useQuery({ queryKey: weeklyPlanQueryKey, queryFn: fetchWeeklyPlan })
}

/** Día de la semana de una fecha `AAAA-MM-DD`: 1 = lunes … 7 = domingo. */
export const isoWeekday = (date: string): number => weekdayIndex(date) + 1

/** La fila del plan para una fecha (con o sin rutina vigente), o `null` si ese día no tiene nada asignado. */
export function planDayFor(
  plan: readonly WeeklyPlanDay[] | undefined,
  date: string,
): WeeklyPlanDay | null {
  return plan?.find((day) => day.weekday === isoWeekday(date)) ?? null
}
