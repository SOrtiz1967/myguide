import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchHistory, fetchLatest, HISTORY_PAGE_SIZE } from './api'
import type { ActivityKind } from './activity'

export const activityKey = ['activity'] as const

export function useLatestActivity() {
  return useQuery({ queryKey: [...activityKey, 'latest'], queryFn: fetchLatest })
}

export function useActivityHistory(kind: ActivityKind) {
  return useInfiniteQuery({
    queryKey: [...activityKey, 'history', kind],
    queryFn: ({ pageParam }) => fetchHistory(kind, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length * HISTORY_PAGE_SIZE : undefined,
  })
}
