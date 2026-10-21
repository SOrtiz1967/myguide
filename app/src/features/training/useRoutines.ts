import { useQuery } from '@tanstack/react-query'
import { fetchRoutine, fetchRoutines } from './api'

export const routinesQueryKey = ['training', 'routines'] as const
export const routineQueryKey = (id: string) => ['training', 'routine', id] as const

export function useRoutines() {
  return useQuery({ queryKey: routinesQueryKey, queryFn: fetchRoutines })
}

export function useRoutine(id: string) {
  return useQuery({
    queryKey: routineQueryKey(id),
    queryFn: () => fetchRoutine(id),
    enabled: id !== '',
  })
}
