import { useQuery } from '@tanstack/react-query'
import { addDays } from '../meals/meals'
import { useToday } from '../meals/useToday'
import { fetchLatest } from '../measures/api'
import { fetchSessionsBetween } from '../training/api'
import { useProfile } from '../profile/useProfile'
import { LOGGED_WINDOW_WEEKS, planInputFrom } from './calorie'

/**
 * La entrada del cálculo calórico con lo que hay guardado: perfil, último peso y sesiones realizadas
 * en las últimas 4 semanas. Si falta algo, dice qué falta.
 */
export function usePlanInputs() {
  const today = useToday()
  const profile = useProfile()
  const from = addDays(today, -(LOGGED_WINDOW_WEEKS * 7 - 1))
  const latest = useQuery({ queryKey: ['measures', 'latest'], queryFn: fetchLatest })
  const sessions = useQuery({
    queryKey: ['training', 'plan-window', from, today],
    queryFn: () => fetchSessionsBetween(from, today),
  })

  const isPending = profile.isPending || latest.isPending || sessions.isPending
  const isError = profile.isError || latest.isError || sessions.isError
  const refetch = () => {
    void profile.refetch()
    void latest.refetch()
    void sessions.refetch()
  }

  if (isPending || isError || !profile.data) {
    return { isPending, isError: isError || (!isPending && !profile.data), refetch, result: null }
  }
  const completed = (sessions.data ?? []).filter((session) => session.status === 'completed').length
  const result = planInputFrom(profile.data, latest.data?.weight?.value ?? null, completed, today)
  return { isPending: false, isError: false, refetch, result }
}
