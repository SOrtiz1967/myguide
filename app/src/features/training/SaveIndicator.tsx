import { es } from '../../copy/es'
import type { EditorIndicator } from './useSessionEditor'

const t = es.training.saveIndicator

const TEXT: Record<EditorIndicator, string> = {
  saved: t.saved,
  saving: t.saving,
  unsaved: t.unsaved,
  offline: t.offline,
  failed: t.failed,
}

/**
 * Qué está guardado en el servidor y qué solo en este dispositivo (FR-046). «Guardado» aparece únicamente cuando
 * el servidor lo confirmó. El texto es el que se anuncia a los lectores de pantalla.
 */
export function SaveIndicator({ indicator }: { indicator: EditorIndicator }) {
  const pending = indicator !== 'saved'
  return (
    <p
      role="status"
      className={`inline-flex min-h-11 items-center gap-2 text-sm ${pending ? 'font-medium' : 'text-muted'}`}
    >
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full border-2 border-current ${indicator === 'saved' ? 'bg-current' : ''}`}
      />
      {TEXT[indicator]}
    </p>
  )
}
