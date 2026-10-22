import { useQuery } from '@tanstack/react-query'
import { fetchDueSessions, fetchSessionsBetween, fetchSessionsOfDay } from './api'
import { gridRange, type MonthRef } from './calendar'

/** Las sesiones que cubre la cuadrícula de un mes. */
export function useMonthSessions(month: MonthRef) {
  const { from, to } = gridRange(month)
  return useQuery({
    queryKey: ['training', 'month', from, to],
    queryFn: () => fetchSessionsBetween(from, to),
  })
}

export function useDaySessions(day: string) {
  return useQuery({
    queryKey: ['training', 'day', day],
    queryFn: () => fetchSessionsOfDay(day),
    enabled: day !== '',
  })
}

/** Las planificadas de hoy o anteriores. */
export function useDueSessions(today: string) {
  return useQuery({ queryKey: ['training', 'due', today], queryFn: () => fetchDueSessions(today) })
}
