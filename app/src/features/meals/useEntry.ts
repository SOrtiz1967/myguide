import { useQuery } from '@tanstack/react-query'
import { fetchEntry } from './api'

export const entryQueryKey = (id: string) => ['meals', 'entry', id] as const

export function useEntry(id: string) {
  return useQuery({ queryKey: entryQueryKey(id), queryFn: () => fetchEntry(id) })
}
