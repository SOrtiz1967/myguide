import { es } from '../copy/es'

/** Forma mínima de un error de red, de Auth o de una Edge Function, ya normalizado por quien llama. */
export interface AppErrorInput {
  code?: string
  status?: number
  message?: string
  /** El pedido no llegó al servidor (sin conexión, DNS, tiempo agotado). */
  network?: boolean
  context?: 'register' | 'captcha' | 'login' | 'recover'
}

const CREDENTIAL_CODES = new Set(['invalid_credentials', 'user_not_found'])

/**
 * Traduce un error técnico a un mensaje seguro para el usuario.
 * Nunca devuelve el texto crudo del proveedor (puede revelar detalles internos).
 */
export function toUserMessage(error: AppErrorInput): string {
  if (error.network) return es.errors.offline
  if (error.code === 'account_exists') return es.errors.accountExists
  if (error.code === 'captcha_unavailable') return es.errors.captchaUnavailable
  if (error.code === 'captcha_rejected') return es.errors.captchaRejected
  if (error.context === 'register' && error.status === 409) return es.errors.accountExists
  if (error.context === 'captcha' && error.status === 503) return es.errors.captchaUnavailable
  if (
    error.code === 'over_request_rate_limit' ||
    error.code === 'rate_limited' ||
    error.status === 429
  ) {
    return es.errors.rateLimited
  }
  if (error.code === 'weak_password') return es.errors.weakPassword
  if (
    (error.code && CREDENTIAL_CODES.has(error.code)) ||
    (error.message && /invalid login credentials/i.test(error.message))
  ) {
    return es.errors.invalidCredentials
  }
  return es.errors.generic
}
