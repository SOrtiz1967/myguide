import { useQuery } from '@tanstack/react-query'
import { fetchDayEntries } from './api'
import { groupByMeal } from './meals'
import { sumEntries } from './mealTotals'

export const dayQueryKey = (date: string) => ['meals', 'day', date] as const

/** Los ítems de un día agrupados por comida, con el subtotal de cada una y el total del día. */
export function useDay(date: string) {
  const query = useQuery({ queryKey: dayQueryKey(date), queryFn: () => fetchDayEntries(date) })
  const entries = query.data ?? []
  const grouped = groupByMeal(entries)
  return {
    query,
    entries,
    grouped,
    dayTotal: sumEntries(entries),
    subtotal: (meal: keyof typeof grouped) => sumEntries(grouped[meal]),
  }
}
