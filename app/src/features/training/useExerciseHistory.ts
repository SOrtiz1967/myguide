import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchExerciseHistory, HISTORY_PAGE_SIZE } from './api'

/** La historia de un ejercicio por tandas («Ver más»). */
export function useExerciseHistory(exerciseId: string) {
  return useInfiniteQuery({
    queryKey: ['training', 'history', exerciseId],
    queryFn: ({ pageParam }) =>
      fetchExerciseHistory(exerciseId, null, HISTORY_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.entries.length, 0)
      return loaded < last.total ? loaded : undefined
    },
    enabled: exerciseId !== '',
  })
}

/** La última vez que se hizo el ejercicio, sin contar la sesión actual. Solo se consulta cuando se pide. */
export function useLastTime(exerciseId: string, sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['training', 'last-time', exerciseId, sessionId],
    queryFn: async () =>
      (await fetchExerciseHistory(exerciseId, sessionId, 1, 0)).entries[0] ?? null,
    enabled,
  })
}
