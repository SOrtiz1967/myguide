import { useQuery } from '@tanstack/react-query'
import { fetchDayStatus } from './api'

export const dayStatusQueryKey = ['meals', 'status'] as const

/**
 * El día que se propone y si el anterior todavía se está cerrando. Si el servidor no responde se sigue
 * sin propuesta: registrar en el día de hoy siempre es posible.
 */
export function useDayStatus() {
  return useQuery({ queryKey: dayStatusQueryKey, queryFn: fetchDayStatus })
}
