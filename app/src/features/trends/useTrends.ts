import { useQuery } from '@tanstack/react-query'
import {
  fetchNutritionDays,
  fetchSleepBetween,
  fetchTrainingSets,
  fetchWeights,
  fetchWeightUpTo,
} from './api'
import { maintenanceWindow } from './maintenance'

export const trendsKey = ['trends'] as const

/** Los totales diarios de comidas del período. */
export function useNutritionDays(from: string, to: string) {
  return useQuery({
    queryKey: [...trendsKey, 'nutrition', from, to],
    queryFn: () => fetchNutritionDays(from, to),
  })
}

/** El último peso hasta el final del período, para la proteína por kilo. */
export function useWeightUpTo(to: string) {
  return useQuery({
    queryKey: [...trendsKey, 'weight-up-to', to],
    queryFn: () => fetchWeightUpTo(to),
  })
}

/** Los datos de la ventana de 21 días terminados del mantenimiento estimado (comidas y pesos). */
export function useMaintenanceData(today: string) {
  const { from, to } = maintenanceWindow(today)
  const nutrition = useQuery({
    queryKey: [...trendsKey, 'maintenance-nutrition', from, to],
    queryFn: () => fetchNutritionDays(from, to),
  })
  const weights = useQuery({
    queryKey: [...trendsKey, 'maintenance-weights', from, to],
    queryFn: () => fetchWeights(from, to),
  })
  return { nutrition, weights }
}

/** Las series por semana y grupo muscular del período. */
export function useTrainingSets(from: string, to: string) {
  return useQuery({
    queryKey: [...trendsKey, 'training', from, to],
    queryFn: () => fetchTrainingSets(from, to),
  })
}

/** El sueño registrado en el período. */
export function useSleepBetween(from: string, to: string) {
  return useQuery({
    queryKey: [...trendsKey, 'sleep', from, to],
    queryFn: () => fetchSleepBetween(from, to),
  })
}
