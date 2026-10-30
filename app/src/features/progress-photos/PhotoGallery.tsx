import { es } from '../../copy/es'
import { formatDay } from '../meals/meals'
import type { ProgressPhoto } from './api'
import { PhotoImage } from './PhotoImage'
import { groupByDate, poseLabel } from './photoText'

const copy = es.progressPhotos.list

interface PhotoGalleryProps {
  photos: ProgressPhoto[]
  urls: Record<string, string> | undefined
  urlsFailed: boolean
  openId: string | null
  compareIds: string[]
  onOpen: (id: string) => void
  onToggleCompare: (id: string) => void
}

/** Las fotos agrupadas por fecha, de la más reciente a la más antigua. Cada una se abre o se elige para comparar. */
export function PhotoGallery({
  photos,
  urls,
  urlsFailed,
  openId,
  compareIds,
  onOpen,
  onToggleCompare,
}: PhotoGalleryProps) {
  const full = compareIds.length >= 2
  return (
    <div className="flex flex-col gap-5">
      {full ? (
        <p role="status" className="text-sm text-muted">
          {copy.compareFull}
        </p>
      ) : null}
      {groupByDate(photos).map((day) => (
        <section key={day.date} aria-label={formatDay(day.date)} className="flex flex-col gap-2">
          <h3 className="text-base font-bold">{formatDay(day.date)}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {day.photos.map((photo) => {
              const checked = compareIds.includes(photo.id)
              const dayText = formatDay(photo.taken_on)
              const poseText = poseLabel(photo.pose).toLowerCase()
              return (
                <li key={photo.id} className="card-inset flex flex-col gap-2 p-2">
                  <button
                    type="button"
                    className="block overflow-hidden rounded-md text-left"
                    aria-label={copy.openLabel(dayText, poseText)}
                    aria-pressed={openId === photo.id}
                    onClick={() => onOpen(photo.id)}
                  >
                    <PhotoImage
                      photo={photo}
                      url={urls?.[photo.storage_path]}
                      failed={urlsFailed}
                      className="rounded-md"
                    />
                  </button>
                  <p className="px-1 text-sm text-muted">{poseLabel(photo.pose)}</p>
                  <label className="flex min-h-11 items-center gap-2 px-1 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={full && !checked}
                      aria-label={copy.compareLabel(dayText, poseText)}
                      onChange={() => onToggleCompare(photo.id)}
                    />
                    {copy.compare}
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
