import { es } from '../../copy/es'

/**
 * Traduce un error conocido del servidor (`not_found`, `invalid_entry:<motivo>:<campo>`...) a un
 * mensaje claro. Devuelve `null` si no lo reconoce: quien llama usa entonces el mensaje general.
 * Nunca se muestra el texto crudo del servidor.
 */
export function entryErrorMessage(error: unknown): string | null {
  const message = (error as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null

  if (message.startsWith('not_found')) return es.meals.errors.foodGone
  if (message.startsWith('session_expired')) return es.auth.sessionExpired
  if (message.startsWith('invalid_entry:invalid_quantity')) return es.meals.errors.quantity
  if (message.startsWith('invalid_entry:invalid_portion_count')) return es.meals.errors.portionCount
  if (message.startsWith('invalid_entry:invalid_date')) return es.meals.errors.invalidDate
  if (message.startsWith('invalid_entry:')) return es.meals.errors.saveFailed
  return null
}
