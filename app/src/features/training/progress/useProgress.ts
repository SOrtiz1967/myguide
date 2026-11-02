import { useQuery } from '@tanstack/react-query'
import { fetchCompletedDates, fetchExerciseProgress } from './api'

export const progressKey = ['training', 'progress'] as const

/** Las sesiones realizadas de un ejercicio con sus series crudas. */
export function useExerciseProgress(exerciseId: string) {
  return useQuery({
    queryKey: [...progressKey, 'exercise', exerciseId],
    queryFn: () => fetchExerciseProgress(exerciseId),
    enabled: exerciseId !== '',
  })
}

/** Los días de las sesiones realizadas desde un día (o desde el principio). */
export function useCompletedDates(from: string | null) {
  return useQuery({
    queryKey: [...progressKey, 'dates', from],
    queryFn: () => fetchCompletedDates(from),
  })
}
