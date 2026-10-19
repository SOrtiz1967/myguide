import { useQuery } from '@tanstack/react-query'
import { fetchPhotos } from './api'

export const photosQueryKey = (date: string) => ['meals', 'photos', date] as const

/** Las fotos de las comidas de un día. Es un extra: si no cargan, el día se ve igual. */
export function usePhotos(date: string) {
  return useQuery({ queryKey: photosQueryKey(date), queryFn: () => fetchPhotos(date) })
}
