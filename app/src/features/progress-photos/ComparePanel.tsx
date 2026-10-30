import { Fragment } from 'react'
import { es } from '../../copy/es'
import { formatDay } from '../meals/meals'
import type { ProgressPhoto } from './api'
import { PhotoImage } from './PhotoImage'
import { daysBetween, orderForCompare, poseLabel, posesDiffer } from './photoText'

const copy = es.progressPhotos.compare

interface ComparePanelProps {
  /** Las fotos elegidas (una o dos), en el orden en que se eligieron. */
  photos: ProgressPhoto[]
  urls: Record<string, string> | undefined
  urlsFailed: boolean
  onClear: () => void
}

/**
 * Dos fotos elegidas, una al lado de la otra (apiladas en el celular), con su fecha y su pose. La comparación solo
 * muestra: no procesa las fotos ni dice nada sobre el cuerpo (spec 019, FR-011 a FR-013).
 */
export function ComparePanel({ photos, urls, urlsFailed, onClear }: ComparePanelProps) {
  if (photos.length === 0) return null
  const pair = photos.length === 2 ? orderForCompare(photos[0]!, photos[1]!) : null

  return (
    <section aria-labelledby="comparacion-titulo" className="card card-body flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="comparacion-titulo" className="text-lg font-extrabold">
          {copy.title}
        </h2>
        <button type="button" className="btn-secondary" onClick={onClear}>
          {copy.clear}
        </button>
      </div>

      {pair ? (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pair.map((photo, index) => (
              <li key={photo.id} className="flex flex-col gap-2">
                <figure className="flex flex-col gap-2">
                  <PhotoImage
                    photo={photo}
                    url={urls?.[photo.storage_path]}
                    failed={urlsFailed}
                    lazy={false}
                    className="rounded-xl"
                  />
                  <figcaption className="text-sm">
                    <span className="font-bold">{index === 0 ? copy.before : copy.after}</span>
                    <Fragment>
                      {': '}
                      {formatDay(photo.taken_on)}, {poseLabel(photo.pose).toLowerCase()}
                    </Fragment>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <p>{copy.daysApart(daysBetween(pair[0].taken_on, pair[1].taken_on))}</p>
          {posesDiffer(pair[0], pair[1]) ? (
            <p role="status" className="text-muted">
              {copy.differentPose}
            </p>
          ) : null}
        </>
      ) : (
        <p role="status">{copy.pickOther}</p>
      )}

      <p className="text-sm text-muted">{copy.note}</p>
    </section>
  )
}
