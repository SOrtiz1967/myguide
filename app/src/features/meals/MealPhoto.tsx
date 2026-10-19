import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorState } from '../../components/ErrorState'
import { es } from '../../copy/es'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { deletePhoto, photoUrl, uploadPhoto, type MealPhotoRow } from './api'
import { formatDay, mealLabel, type Meal } from './meals'
import {
  PHOTO_URL_SECONDS,
  PhotoError,
  PhotoRequestError,
  preparePhoto,
  type PhotoErrorCode,
} from './photo'
import { photosQueryKey } from './usePhotos'

const photoMessages = es.meals.photo.errors

const preparationMessage: Record<PhotoErrorCode, string> = {
  not_image: photoMessages.notImage,
  too_big: photoMessages.tooBig,
  heic: photoMessages.heic,
  unreadable: photoMessages.unreadable,
}

/** Traduce lo que responde la función `meal-photo` a un mensaje claro. Nunca el texto crudo. */
function uploadMessage(error: unknown): string | null {
  if (!(error instanceof PhotoRequestError)) return photoMessages.failed
  switch (error.code) {
    case 'too_large':
      return photoMessages.tooLarge
    case 'unsupported_type':
    case 'invalid_image':
      return photoMessages.unreadable
    case 'rate_limited':
      return photoMessages.rateLimited
    case 'unauthorized':
      return es.auth.sessionExpired
    default:
      return photoMessages.failed
  }
}

interface MealPhotoProps {
  date: string
  meal: Meal
  photo?: MealPhotoRow
}

/**
 * Foto opcional de una comida (FR-030 a FR-035). Se reduce en el navegador, el servidor le quita los
 * metadatos y se guarda en privado; se muestra con una URL firmada de 10 minutos que se renueva sola.
 * Un fallo aquí nunca toca los ítems de la comida.
 */
export function MealPhoto({ date, meal, photo }: MealPhotoProps) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const name = mealLabel(meal)
  const path = photo?.storage_path
  const url = useQuery({
    queryKey: ['meals', 'photo-url', path],
    queryFn: () => photoUrl(path ?? ''),
    enabled: Boolean(path),
    // Se renueva un minuto antes de que venza, para que la imagen nunca quede con un enlace caído.
    staleTime: (PHOTO_URL_SECONDS - 60) * 1000,
    refetchInterval: (PHOTO_URL_SECONDS - 60) * 1000,
  })
  const [imageFailed, setImageFailed] = useState(false)

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: photosQueryKey(date) })
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    setNotice(null)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError(es.errors.offline)
      if (input.current) input.current.value = ''
      return
    }
    setBusy(true)
    try {
      const blob = await preparePhoto(file)
      await saveRemotely(() => uploadPhoto(date, meal, blob), uploadMessage)
      setImageFailed(false)
      await refresh()
      setNotice(es.meals.photo.uploaded)
    } catch (e) {
      if (e instanceof PhotoError) setError(preparationMessage[e.code])
      else if (e instanceof WriteError) setError(e.message)
      else setError(es.errors.generic)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setRemoving(true)
    setDeleteError(null)
    try {
      await saveRemotely(() => deletePhoto(date, meal))
      setConfirming(false)
      setExpanded(false)
      await refresh()
      setNotice(es.meals.photo.removed)
    } catch (e) {
      setDeleteError(e instanceof WriteError ? e.message : photoMessages.deleteFailed)
    } finally {
      setRemoving(false)
    }
  }

  const picker = (label: string) => (
    <label className="btn-secondary cursor-pointer focus-within:outline-2 focus-within:outline-offset-2">
      {label}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </label>
  )

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      {photo ? (
        <figure className="flex flex-col gap-2">
          {url.isPending ? <p role="status">{es.meals.photo.loadingImage}</p> : null}
          {(url.isError || imageFailed) && !url.isPending ? (
            <ErrorState
              message={es.meals.photo.imageError}
              onRetry={() => {
                setImageFailed(false)
                void url.refetch()
              }}
            />
          ) : null}
          {url.data && !imageFailed ? (
            <img
              src={url.data}
              alt={es.meals.photo.alt(name, formatDay(date))}
              width={photo.width}
              height={photo.height}
              onError={() => setImageFailed(true)}
              className={
                expanded
                  ? 'h-auto w-full rounded-md border border-line'
                  : 'h-auto max-h-40 w-auto max-w-full rounded-md border border-line object-cover'
              }
            />
          ) : null}
          <figcaption className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? es.meals.photo.shrink : es.meals.photo.enlarge}
            </button>
            {picker(es.meals.photo.replace)}
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setDeleteError(null)
                setConfirming(true)
              }}
            >
              {es.meals.photo.remove}
            </button>
          </figcaption>
        </figure>
      ) : (
        <div className="flex flex-col gap-1">
          <div>{picker(es.meals.photo.add)}</div>
          <p className="text-sm text-muted">{es.meals.photo.privacy}</p>
        </div>
      )}

      {busy ? (
        <p role="status" className="flex items-center gap-2">
          <progress aria-label={es.meals.photo.sending} className="h-2 w-24" />
          {es.meals.photo.sending}
        </p>
      ) : null}
      {!busy && notice ? <p role="status">{notice}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title={es.meals.photo.deleteTitle}
          description={es.meals.photo.deleteBody}
          confirmLabel={es.meals.photo.confirmDelete}
          cancelLabel={es.meals.photo.cancel}
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
          busy={removing}
          error={deleteError}
        />
      ) : null}
    </div>
  )
}
