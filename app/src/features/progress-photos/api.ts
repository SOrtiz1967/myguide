import { supabase } from '../../lib/supabase'
import { PHOTO_URL_SECONDS, PhotoRequestError } from '../meals/photo'

// Acceso a datos de las fotos de progreso (spec 019). El cliente lee lo propio y pide enlaces firmados;
// subir y eliminar pasa por la función `progress-photo` y corregir fecha y pose por `update_progress_photo`.

export type Pose = 'front' | 'side' | 'back' | 'other'
export const POSES: readonly Pose[] = ['front', 'side', 'back', 'other']

/** Tope de fotos por cuenta (FR-010); la función lo hace valer, aquí solo se avisa antes. */
export const MAX_PHOTOS = 200

export interface ProgressPhoto {
  id: string
  taken_on: string
  pose: Pose | null
  storage_path: string
  width: number
  height: number
  bytes: number
  created_at: string
}

const COLUMNS = 'id, taken_on, pose, storage_path, width, height, bytes, created_at'

/** De la fecha más reciente a la más antigua; a igual fecha, la subida más reciente primero. */
export async function fetchProgressPhotos(): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select(COLUMNS)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProgressPhoto[]
}

/** Enlaces firmados de 10 minutos para varias fotos de una vez, por ruta. */
export async function progressPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from('progress-photos')
    .createSignedUrls(paths, PHOTO_URL_SECONDS)
  if (error || !data) throw error ?? new Error('sin URLs firmadas')
  const urls: Record<string, string> = {}
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
  }
  return urls
}

async function photoFailure(error: unknown): Promise<Error> {
  const name = (error as { name?: string } | null)?.name
  // La petición no llegó al servidor: se trata como falta de conexión.
  if (name === 'FunctionsFetchError') return new TypeError('Failed to fetch')
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { code?: string }
      return new PhotoRequestError(body.code ?? `http_${context.status}`)
    } catch {
      return new PhotoRequestError(`http_${context.status}`)
    }
  }
  return new PhotoRequestError('unknown')
}

/** Sube una foto ya reducida. El servidor le quita los metadatos y la guarda en privado. */
export async function uploadProgressPhoto(
  takenOn: string,
  pose: Pose | null,
  photo: Blob,
): Promise<void> {
  const body = new FormData()
  body.append('taken_on', takenOn)
  if (pose) body.append('pose', pose)
  body.append('photo', photo, 'foto.jpg')
  const { error } = await supabase.functions.invoke('progress-photo', { method: 'POST', body })
  if (error) throw await photoFailure(error)
}

/** Corrige la fecha y la pose de una foto sin tocar el archivo. */
export async function updateProgressPhoto(
  id: string,
  takenOn: string,
  pose: Pose | null,
): Promise<void> {
  const { error } = await supabase.rpc('update_progress_photo', {
    p_id: id,
    p_taken_on: takenOn,
    p_pose: pose,
  })
  if (error) throw error
}

/** Elimina una foto y su archivo. Es idempotente: si ya no está, responde igual. */
export async function deleteProgressPhoto(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke(`progress-photo?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (error) throw await photoFailure(error)
}
