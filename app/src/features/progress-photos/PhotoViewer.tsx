import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { formatDay } from '../meals/meals'
import { useToday } from '../meals/useToday'
import {
  deleteProgressPhoto,
  POSES,
  updateProgressPhoto,
  type Pose,
  type ProgressPhoto,
} from './api'
import { PhotoImage } from './PhotoImage'
import { poseLabel } from './photoText'
import { progressPhotosQueryKey } from './useProgressPhotos'

const copy = es.progressPhotos.viewer

/** Mensajes seguros para los errores de `update_progress_photo`; nunca el texto crudo del servidor. */
function updateMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  if (/invalid_date/i.test(message)) return es.progressPhotos.upload.dateInvalid
  if (/photo_not_found/i.test(message)) return copy.gone
  return null
}

interface PhotoViewerProps {
  photo: ProgressPhoto
  url: string | undefined
  urlFailed: boolean
  onClose: () => void
}

/**
 * La foto abierta en grande, con su fecha y su pose: se pueden corregir (sin volver a subir el archivo) y se puede
 * eliminar con confirmación. El foco pasa al título al abrirse, para que el lector de pantalla lo anuncie.
 */
export function PhotoViewer({ photo, url, urlFailed, onClose }: PhotoViewerProps) {
  const queryClient = useQueryClient()
  const today = useToday()
  const heading = useRef<HTMLHeadingElement>(null)
  const [date, setDate] = useState(photo.taken_on)
  const [pose, setPose] = useState<Pose | ''>(photo.pose ?? '')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [photo.id])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: progressPhotosQueryKey })

  const save = useMutation({
    mutationFn: () =>
      saveRemotely(
        () => updateProgressPhoto(photo.id, date, pose === '' ? null : pose),
        updateMessage,
      ),
    onMutate: () => setMessage(null),
    onSuccess: async () => {
      setMessage({ kind: 'ok', text: copy.saved })
      await invalidate()
    },
    onError: (e) =>
      setMessage({ kind: 'error', text: e instanceof WriteError ? e.message : copy.saveFailed }),
  })

  const remove = useMutation({
    mutationFn: () => saveRemotely(() => deleteProgressPhoto(photo.id)),
    onMutate: () => setDeleteError(null),
    onSuccess: async () => {
      setConfirming(false)
      await invalidate()
      onClose()
    },
    onError: (e) => setDeleteError(e instanceof WriteError ? e.message : copy.deleteFailed),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    if (date === photo.taken_on && pose === (photo.pose ?? '')) {
      setMessage({ kind: 'ok', text: copy.noChanges })
      return
    }
    if (!date || date > today) {
      setMessage({ kind: 'error', text: es.progressPhotos.upload.dateInvalid })
      return
    }
    save.mutate()
  }

  return (
    <section aria-labelledby="foto-abierta-titulo" className="card card-body flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="foto-abierta-titulo" ref={heading} tabIndex={-1} className="text-lg font-extrabold">
          {copy.title}: {formatDay(photo.taken_on)}, {poseLabel(photo.pose).toLowerCase()}
        </h2>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {copy.close}
        </button>
      </div>

      <div className="mx-auto w-full max-w-md">
        <PhotoImage
          photo={photo}
          url={url}
          failed={urlFailed}
          lazy={false}
          className="rounded-xl"
        />
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <h3 className="text-base font-bold">{copy.editTitle}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            type="date"
            label={es.progressPhotos.upload.date}
            value={date}
            max={today}
            min="2000-01-01"
            disabled={save.isPending}
            onChange={(event) => setDate(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="foto-abierta-pose" className="text-sm font-semibold text-muted">
              {es.progressPhotos.upload.pose}
            </label>
            <select
              id="foto-abierta-pose"
              className="control"
              value={pose}
              disabled={save.isPending}
              onChange={(event) => setPose(event.target.value as Pose | '')}
            >
              <option value="">{es.progressPhotos.poseNone}</option>
              {POSES.map((value) => (
                <option key={value} value={value}>
                  {poseLabel(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {copy.save}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={save.isPending || remove.isPending}
            onClick={() => {
              setDeleteError(null)
              setConfirming(true)
            }}
          >
            {copy.delete}
          </button>
        </div>
        {message ? (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={message.kind === 'error' ? 'notice-error px-4 py-3' : undefined}
          >
            {message.text}
          </p>
        ) : null}
      </form>

      {confirming ? (
        <ConfirmDialog
          title={copy.deleteTitle}
          description={copy.deleteBody}
          confirmLabel={copy.confirmDelete}
          cancelLabel={copy.cancel}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirming(false)}
          busy={remove.isPending}
          error={deleteError}
        />
      ) : null}
    </section>
  )
}
