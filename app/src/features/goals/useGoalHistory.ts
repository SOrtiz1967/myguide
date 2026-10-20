import { useQuery } from '@tanstack/react-query'
import { fetchGoalHistory } from './api'

export const goalHistoryKey = ['goals', 'history'] as const

/**
 * El historial del objetivo, compartido por todos los días que se ven: navegar entre días dentro del
 * `staleTime` no agrega pedidos, y al volver a enfocar la ventana (ya vencido) se pide de nuevo, para
 * ver un cambio hecho en otra pestaña o dispositivo.
 */
export function useGoalHistory() {
  return useQuery({
    queryKey: goalHistoryKey,
    queryFn: fetchGoalHistory,
    staleTime: 30_000,
  })
}
