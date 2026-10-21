import { useQuery } from '@tanstack/react-query'
import { fetchSession } from './api'

export const sessionQueryKey = (id: string) => ['training', 'session', id] as const

export function useSession(id: string) {
  return useQuery({ queryKey: sessionQueryKey(id), queryFn: () => fetchSession(id) })
}
