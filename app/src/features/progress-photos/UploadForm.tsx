import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { isDateInRange } from '../meals/meals'
import { PhotoError, PhotoRequestError, preparePhoto, type PhotoErrorCode } from '../meals/photo'
import { useToday } from '../meals/useToday'
import { POSES, uploadProgressPhoto, type Pose } from './api'
import { poseLabel } from './photoText'
import { progressPhotosQueryKey } from './useProgressPhotos'

const copy = es.progressPhotos
const errors = copy.errors

const preparationMessage: Record<PhotoErrorCode, string> = {
  not_image: errors.notImage,
  too_big: errors.tooBig,
  heic: errors.heic,
  unreadable: errors.unreadable,
}

/** Traduce lo que responde la función `progress-photo` a un mensaje claro. Nunca el texto crudo. */
function uploadMessage(error: unknown): string | null {
  if (!(error instanceof PhotoRequestError)) return errors.failed
  switch (error.code) {
    case 'too_large':
      return errors.tooLarge
    case 'unsupported_type':
    case 'invalid_image':
      return errors.unreadable
    case 'rate_limited':
      return errors.rateLimited
    case 'limit_reached':
      return copy.upload.limitReached
    case 'invalid_request':
      return copy.upload.dateInvalid
    case 'unauthorized':
      return es.auth.sessionExpired
    default:
      return errors.failed
  }
}

/** La fecha máxima que acepta la pantalla es hoy; la función admite hasta mañana por la zona horaria. */
const isPastOrToday = (date: string, today: string) => date <= today && isDateInRange(date, today)

interface UploadFormProps {
  /** Con el tope alcanzado el formulario avisa y no ofrece subir. */
  full: boolean
}

/**
 * Sube una foto de progreso (spec 019): se reduce en el navegador, el servidor le quita los metadatos y la guarda en
 * privado. El botón se bloquea mientras sube para que un doble toque no la duplique.
 */
export function UploadForm({ full }: UploadFormProps) {
  const queryClient = useQueryClient()
  const today = useToday()
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [date, setDate] = useState<string | null>(null)
  const [pose, setPose] = useState<Pose | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const takenOn = date ?? today

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new PhotoError('not_image')
      const blob = await preparePhoto(file)
      await saveRemotely(
        () => uploadProgressPhoto(takenOn, pose === '' ? null : pose, blob),
        uploadMessage,
      )
    },
    onMutate: () => {
      setError(null)
      setNotice(null)
    },
    onSuccess: async () => {
      setFile(null)
      setFileKey((key) => key + 1)
      setNotice(copy.upload.saved)
      await queryClient.invalidateQueries({ queryKey: progressPhotosQueryKey })
    },
    onError: (e) => {
      if (e instanceof PhotoError) setError(preparationMessage[e.code])
      else if (e instanceof WriteError) setError(e.message)
      else setError(es.errors.generic)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (upload.isPending) return
    if (!file) {
      setError(copy.upload.chooseFile)
      return
    }
    if (!isPastOrToday(takenOn, today)) {
      setError(copy.upload.dateInvalid)
      return
    }
    upload.mutate()
  }

  return (
    <section aria-labelledby="fotos-subir-titulo" className="card flex flex-col gap-3">
      <h2 id="fotos-subir-titulo" className="text-lg font-extrabold">
        {copy.upload.title}
      </h2>
      {full ? (
        <p role="status" className="notice-error px-4 py-3">
          {copy.upload.limitReached}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <Field
            key={fileKey}
            type="file"
            accept="image/*"
            label={copy.upload.file}
            hint={copy.upload.fileHint}
            disabled={upload.isPending}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              type="date"
              label={copy.upload.date}
              value={takenOn}
              max={today}
              min="2000-01-01"
              disabled={upload.isPending}
              onChange={(event) => setDate(event.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="foto-pose" className="text-sm font-semibold text-muted">
                {copy.upload.pose}
              </label>
              <select
                id="foto-pose"
                className="control"
                value={pose}
                disabled={upload.isPending}
                aria-describedby="foto-pose-hint"
                onChange={(event) => setPose(event.target.value as Pose | '')}
              >
                <option value="">{copy.poseNone}</option>
                {POSES.map((value) => (
                  <option key={value} value={value}>
                    {poseLabel(value)}
                  </option>
                ))}
              </select>
              <p id="foto-pose-hint" className="text-sm text-muted">
                {copy.upload.poseHint}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={upload.isPending}>
              {upload.isPending ? copy.upload.sending : copy.upload.submit}
            </button>
            {upload.isPending ? (
              <progress aria-label={copy.upload.sending} className="h-2 w-24" />
            ) : null}
          </div>
        </form>
      )}

      {!upload.isPending && notice ? <p role="status">{notice}</p> : null}
      {error ? (
        <p role="alert" className="notice-error px-4 py-3">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-muted">{copy.privacy}</p>
    </section>
  )
}
