// T087 (FR-004, FR-005, FR-008, FR-027): solicitud de recuperación de contraseña.
// Responde SIEMPRE igual (202) exista o no la cuenta y esté o no confirmado.
import { jsonResponse } from '../_shared/cors.ts'
import { errorCause } from '../_shared/errors.ts'
import type { LogFn } from '../_shared/log.ts'
import { clientIp, methodNotAllowed, preflight, readJsonObject } from '../_shared/request.ts'
import type { TurnstileResult } from '../_shared/turnstile.ts'
import { isValidEmail, normalizeEmail } from '../_shared/validation.ts'

export interface ResetDeps {
  rateLimit(key: string): Promise<boolean>
  verifyTurnstile(token: string, ip: string): Promise<TurnstileResult>
  findUser(email: string): Promise<{ id: string; emailVerified: boolean } | null>
  sendRecovery(email: string): Promise<void>
  log: LogFn
}

const ACCEPTED = { accepted: true }

export async function handleRequestReset(req: Request, deps: ResetDeps): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return methodNotAllowed(req)

  const ip = clientIp(req)
  if (!(await deps.rateLimit(`reset:${ip}`))) {
    return jsonResponse({ code: 'rate_limited' }, 429, origin)
  }

  const body = await readJsonObject(req)
  // Se normaliza primero (espacios y mayúsculas) y recién después se valida el formato.
  const email = body && typeof body.email === 'string' ? normalizeEmail(body.email) : null
  if (!body || !isValidEmail(email)) {
    return jsonResponse({ code: 'invalid_request' }, 400, origin)
  }

  const captcha = await deps.verifyTurnstile(
    typeof body.turnstileToken === 'string' ? body.turnstileToken : '',
    ip,
  )
  if (captcha === 'rejected') return jsonResponse({ code: 'captcha_rejected' }, 403, origin)
  if (captcha === 'unavailable') {
    deps.log('error', 'turnstile_unavailable', { service: 'turnstile', operation: 'reset' })
    return jsonResponse({ code: 'captcha_unavailable' }, 503, origin)
  }

  const user = await deps.findUser(email)

  // FR-027: solo se envía si la cuenta existe y su correo está confirmado.
  if (user?.emailVerified) {
    try {
      await deps.sendRecovery(email)
    } catch (error) {
      // Un fallo del proveedor se registra pero no cambia la respuesta (FR-005, Principio VII).
      deps.log('error', 'recovery_email_failed', { cause: errorCause(error) })
    }
  }

  return jsonResponse(ACCEPTED, 202, origin)
}
