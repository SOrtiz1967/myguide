import { es } from '../../copy/es'
import { formatDay } from '../meals/meals'
import type { Pose, ProgressPhoto } from './api'

// Funciones puras de las fotos de progreso: orden, agrupación, días de diferencia y textos.

const copy = es.progressPhotos

export const poseLabel = (pose: Pose | null): string => (pose ? copy.poses[pose] : copy.poseNone)

/** El nombre de la foto para lectores de pantalla y etiquetas: fecha y pose, sin juicio. */
export const photoName = (photo: Pick<ProgressPhoto, 'taken_on' | 'pose'>): string =>
  `${formatDay(photo.taken_on)}, ${poseLabel(photo.pose).toLowerCase()}`

export interface PhotoDay {
  date: string
  photos: ProgressPhoto[]
}

/** Agrupa por fecha conservando el orden de entrada (ya viene de la más reciente a la más antigua). */
export function groupByDate(photos: ProgressPhoto[]): PhotoDay[] {
  const days: PhotoDay[] = []
  for (const photo of photos) {
    const last = days[days.length - 1]
    if (last && last.date === photo.taken_on) last.photos.push(photo)
    else days.push({ date: photo.taken_on, photos: [photo] })
  }
  return days
}

const toDay = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86_400_000

/** Días de calendario entre dos fechas AAAA-MM-DD, siempre positivos. */
export function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round(toDay(a) - toDay(b)))
}

/** La más antigua primero; a igual fecha, la subida más antigua primero. */
export function orderForCompare(
  a: ProgressPhoto,
  b: ProgressPhoto,
): [ProgressPhoto, ProgressPhoto] {
  const first = a.taken_on !== b.taken_on ? a.taken_on < b.taken_on : a.created_at <= b.created_at
  return first ? [a, b] : [b, a]
}

/** Las poses no son comparables si alguna falta o si son distintas. */
export const posesDiffer = (a: ProgressPhoto, b: ProgressPhoto): boolean =>
  a.pose === null || b.pose === null || a.pose !== b.pose
