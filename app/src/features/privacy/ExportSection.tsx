import { useRef, useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { saveBlob } from '../../lib/download'
import { isNetworkError } from '../../lib/errors'
import { downloadPhoto, fetchExport } from './api'
import {
  dataBlob,
  dataFileName,
  photoFiles,
  photosFileName,
  photosResultMessage,
} from './exportData'
import { ZipBuilder } from './zip'

const copy = es.privacy.export

type Busy = 'data' | 'photos' | null
type Message = { kind: 'ok' | 'info' | 'error'; text: string }

/**
 * Descargas de la spec 011 (FR-002, FR-005, FR-006): el JSON de los registros y el ZIP de las fotos. Se arman en el
 * navegador con lo que la persona ya puede leer; si algo falla no se entrega un archivo que parezca completo.
 */
export function ExportSection() {
  const [busy, setBusy] = useState<Busy>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const cancelled = useRef(false)

  const failMessage = (error: unknown, fallback: string): Message => ({
    kind: 'error',
    text: isNetworkError(error) ? copy.offline : fallback,
  })

  function start(kind: Exclude<Busy, null>): boolean {
    if (busy) return false
    setMessage(null)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setMessage({ kind: 'error', text: copy.offline })
      return false
    }
    cancelled.current = false
    setBusy(kind)
    return true
  }

  async function downloadData() {
    if (!start('data')) return
    try {
      const data = await fetchExport()
      saveBlob(dataBlob(data), dataFileName(data.exported_at))
      setMessage({ kind: 'ok', text: copy.dataReady })
    } catch (e) {
      setMessage(failMessage(e, copy.error))
    } finally {
      setBusy(null)
    }
  }

  async function downloadPhotos() {
    if (!start('photos')) return
    try {
      const data = await fetchExport()
      const files = photoFiles(data)
      if (files.length === 0) {
        setMessage({ kind: 'info', text: copy.noPhotos })
        return
      }
      const zip = new ZipBuilder()
      let missing = 0
      setProgress({ done: 0, total: files.length })
      for (const [index, file] of files.entries()) {
        if (cancelled.current) {
          setMessage({ kind: 'info', text: copy.cancelled })
          return
        }
        try {
          zip.add(file.name, await downloadPhoto(file))
        } catch {
          missing++
        }
        setProgress({ done: index + 1, total: files.length })
      }
      if (cancelled.current) {
        setMessage({ kind: 'info', text: copy.cancelled })
        return
      }
      if (zip.count === 0) {
        setMessage({ kind: 'error', text: copy.photosError })
        return
      }
      saveBlob(zip.finish(), photosFileName(data.exported_at))
      setMessage({
        kind: missing === 0 ? 'ok' : 'error',
        text: photosResultMessage(zip.count, missing),
      })
    } catch (e) {
      setMessage(failMessage(e, copy.error))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  return (
    <section aria-labelledby="descargar-titulo" className="card flex flex-col gap-4">
      <div>
        <h2 id="descargar-titulo" className="text-base font-bold">
          {copy.title}
        </h2>
        <p className="text-sm text-muted">{copy.intro}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() => void downloadData()}
        >
          {busy === 'data' ? copy.working : copy.data}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() => void downloadPhotos()}
        >
          {busy === 'photos' && !progress ? copy.working : copy.photos}
        </button>
        {busy === 'photos' ? (
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              cancelled.current = true
            }}
          >
            {copy.cancel}
          </button>
        ) : null}
      </div>

      {progress ? (
        <p role="status" className="text-muted">
          {copy.progress(progress.done, progress.total)}
        </p>
      ) : null}
      {message?.kind === 'ok' ? <SuccessMessage>{message.text}</SuccessMessage> : null}
      {message?.kind === 'info' ? (
        <p role="status" className="card-inset px-4 py-3">
          {message.text}
        </p>
      ) : null}
      {message?.kind === 'error' ? <ErrorState message={message.text} /> : null}
    </section>
  )
}
