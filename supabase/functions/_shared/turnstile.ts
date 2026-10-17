// Verificación de Cloudflare Turnstile en el servidor (FR-008).
// Distingue entre un rechazo (la persona no pasó el captcha) y una caída del servicio
// (Principio VII): en el segundo caso la operación se bloquea con un aviso para reintentar.

export type TurnstileResult = 'ok' | 'rejected' | 'unavailable'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const DEFAULT_TIMEOUT_MS = 5000

interface VerifyOptions {
  secret: string
  token: string
  ip?: string | null
  timeoutMs?: number
  fetchFn?: typeof fetch
}

export async function verifyTurnstile(options: VerifyOptions): Promise<TurnstileResult> {
  const { secret, token, ip, timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = fetch } = options
  if (!token) return 'rejected'

  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set('remoteip', ip)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchFn(VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
    if (!response.ok) return 'unavailable'

    const body = (await response.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (body.success === true) return 'ok'
    return body['error-codes']?.includes('internal-error') ? 'unavailable' : 'rejected'
  } catch {
    return 'unavailable'
  } finally {
    clearTimeout(timer)
  }
}
