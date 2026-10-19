import { useQuery } from '@tanstack/react-query'
import { fetchFood } from './api'

export const foodQueryKey = (id: string) => ['foods', 'detail', id] as const

export function useFood(id: string) {
  return useQuery({ queryKey: foodQueryKey(id), queryFn: () => fetchFood(id) })
}
