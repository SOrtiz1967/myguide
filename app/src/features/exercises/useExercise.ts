import { useQuery } from '@tanstack/react-query'
import { fetchExercise } from './api'

export const exerciseQueryKey = (id: string) => ['exercises', 'detail', id] as const

export function useExercise(id: string) {
  return useQuery({ queryKey: exerciseQueryKey(id), queryFn: () => fetchExercise(id) })
}
