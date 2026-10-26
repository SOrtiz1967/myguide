import { useQuery } from '@tanstack/react-query'
import { fetchLastEntry } from '../meals/api'
import { fetchLastWeight } from '../measures/api'
import { fetchRecentSessions } from '../training/api'

/** El último ítem de comida registrado. */
export function useLastMealEntry() {
  return useQuery({ queryKey: ['meals', 'last-entry'], queryFn: fetchLastEntry })
}

/** La última sesión de entrenamiento realizada. */
export function useLastSession() {
  return useQuery({
    queryKey: ['training', 'last-session'],
    queryFn: async () => (await fetchRecentSessions(1))[0] ?? null,
  })
}

/** El último peso registrado. */
export function useLastWeight() {
  return useQuery({ queryKey: ['measures', 'last-weight'], queryFn: fetchLastWeight })
}
