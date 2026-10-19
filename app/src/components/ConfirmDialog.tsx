import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ErrorState } from './ErrorState'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** Mientras se ejecuta la acción confirmada. */
  busy?: boolean
  /** Si la acción falló, el mensaje se muestra dentro del diálogo (que sigue abierto). */
  error?: string | null
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])'

/**
 * Diálogo de confirmación accesible (FR-021, FR-030): rol de diálogo modal, foco inicial en
 * "Cancelar" (la opción segura), foco atrapado con Tab, Escape cancela y al cerrar el foco vuelve a
 * quien lo abrió.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  error = null,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const overlay = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  // Quien tenía el foco al abrirse: se lee una sola vez, en el primer render.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    cancel.current?.focus()
    // El resto de la página queda inerte mientras el diálogo está abierto: no se puede tabular,
    // leer con el lector de pantalla ni hacer clic fuera de él.
    const background = Array.from(document.body.children).filter(
      (element) => element !== overlay.current && !element.hasAttribute('inert'),
    )
    background.forEach((element) => element.setAttribute('inert', ''))
    return () => {
      background.forEach((element) => element.removeAttribute('inert'))
      opener?.focus?.()
    }
  }, [opener])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!busy) onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div ref={overlay} className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-line bg-surface p-5 text-ink"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="text-muted">
          {description}
        </p>
        {error ? <ErrorState message={error} /> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            ref={cancel}
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
