import { useCallback, useState } from 'react'
import type { z } from 'zod'
import { discardDraft, loadDraft, saveDraft } from './drafts'

interface UseDraftOptions<T> {
  userId: string
  formId: string
  schema: z.ZodType<T>
}

/**
 * Borrador de un formulario. Lee el borrador una sola vez al montarse (`initial`); `restored` indica
 * que lo mostrado viene de un borrador y no de lo guardado en el servidor.
 */
export function useDraft<T extends Record<string, unknown>>({
  userId,
  formId,
  schema,
}: UseDraftOptions<T>) {
  const [initial] = useState<T | null>(() => loadDraft(userId, formId, schema)?.values ?? null)
  const [restored, setRestored] = useState(initial !== null)

  const save = useCallback((values: T) => saveDraft(userId, formId, values), [userId, formId])

  const discard = useCallback(() => {
    discardDraft(userId, formId)
    setRestored(false)
  }, [userId, formId])

  return { initial, restored, save, discard }
}
