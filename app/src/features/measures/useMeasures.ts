import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchHistory, fetchLatest, HISTORY_PAGE_SIZE } from './api'
import type { MeasureKind } from './measures'

export const measuresKey = ['measures'] as const

export function useLatestMeasures() {
  return useQuery({ queryKey: [...measuresKey, 'latest'], queryFn: fetchLatest })
}

export function useMeasureHistory(kind: MeasureKind) {
  return useInfiniteQuery({
    queryKey: [...measuresKey, 'history', kind],
    queryFn: ({ pageParam }) => fetchHistory(kind, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length * HISTORY_PAGE_SIZE : undefined,
  })
}
