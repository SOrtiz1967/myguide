import { useQuery } from '@tanstack/react-query'
import { PHOTO_URL_SECONDS } from '../meals/photo'
import { fetchProgressPhotos, progressPhotoUrls, type ProgressPhoto } from './api'

export const progressPhotosQueryKey = ['progress-photos'] as const

/** Las fotos de progreso de la persona, de la más reciente a la más antigua. */
export function useProgressPhotos() {
  return useQuery({ queryKey: progressPhotosQueryKey, queryFn: fetchProgressPhotos })
}

/**
 * Los enlaces firmados de las fotos, de una sola vez. Se renuevan un minuto antes de vencer para que la imagen
 * nunca quede con un enlace caído; mientras cambian las fotos se pide un lote nuevo.
 */
export function usePhotoUrls(photos: ProgressPhoto[] | undefined) {
  const paths = (photos ?? []).map((p) => p.storage_path).sort()
  return useQuery({
    queryKey: [...progressPhotosQueryKey, 'urls', paths],
    queryFn: () => progressPhotoUrls(paths),
    enabled: paths.length > 0,
    staleTime: (PHOTO_URL_SECONDS - 60) * 1000,
    refetchInterval: (PHOTO_URL_SECONDS - 60) * 1000,
  })
}
