// T086 (FR-001, FR-002, FR-007, FR-008, FR-026, FR-029): alta de cuenta.
// La lógica vive aquí con dependencias inyectadas para poder probarla; index.ts conecta las reales.
import { jsonResponse } from '../_shared/cors.ts'
import { errorCause } from '../_shared/errors.ts'
import type { LogFn } from '../_shared/log.ts'
import { clientIp, methodNotAllowed, preflight, readJsonObject } from '../_shared/request.ts'
import type { TurnstileResult } from '../_shared/turnstile.ts'
import { isValidEmail, isValidPassword, normalizeEmail } from '../_shared/validation.ts'

export type CreateAccountResult =
  | { status: 'created'; userId: string }
  | { status: 'exists' }
  | { status: 'invalid_privacy_version' }
  | { status: 'error'; cause: string }

export interface RegisterDeps {
  rateLimit(key: string): Promise<boolean>
  verifyTurnstile(token: string, ip: string): Promise<TurnstileResult>
  createAccount(input: {
    email: string
    password: string
    privacyNoticeVersion: string
  }): Promise<CreateAccountResult>
  sendVerification(userId: string, email: string): Promise<{ sent: boolean; cause?: string }>
  log: LogFn
}

export async function handleRegister(req: Request, deps: RegisterDeps): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return methodNotAllowed(req)

  const ip = clientIp(req)
  if (!(await deps.rateLimit(`register:${ip}`))) {
    return jsonResponse({ code: 'rate_limited' }, 429, origin)
  }

  const body = await readJsonObject(req)
  if (!body) return jsonResponse({ code: 'invalid_request' }, 400, origin)

  const { password, turnstileToken, privacyNoticeVersion } = body
  // Se normaliza primero (espacios y mayúsculas) y recién después se valida el formato.
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : body.email
  if (!isValidEmail(email) || !isValidPassword(password)) {
    return jsonResponse({ code: 'invalid_credentials_format' }, 400, origin)
  }
  if (typeof privacyNoticeVersion !== 'string' || privacyNoticeVersion === '') {
    return jsonResponse({ code: 'privacy_notice_invalid' }, 400, origin)
  }

  const captcha = await deps.verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : '',
    ip,
  )
  if (captcha === 'rejected') return jsonResponse({ code: 'captcha_rejected' }, 403, origin)
  if (captcha === 'unavailable') {
    deps.log('error', 'turnstile_unavailable', { service: 'turnstile', operation: 'register' })
    return jsonResponse({ code: 'captcha_unavailable' }, 503, origin)
  }

  const normalizedEmail = email
  const account = await deps.createAccount({
    email: normalizedEmail,
    password,
    privacyNoticeVersion,
  })

  if (account.status === 'exists') return jsonResponse({ code: 'account_exists' }, 409, origin)
  if (account.status === 'invalid_privacy_version') {
    return jsonResponse({ code: 'privacy_notice_invalid' }, 400, origin)
  }
  if (account.status === 'error') {
    deps.log('error', 'create_account_failed', { cause: account.cause })
    return jsonResponse({ code: 'internal_error' }, 500, origin)
  }

  // La cuenta ya existe: un fallo del correo nunca deshace el alta (FR-026, Principio VII).
  let verificationEmailSent = false
  try {
    const sent = await deps.sendVerification(account.userId, normalizedEmail)
    verificationEmailSent = sent.sent
    if (!sent.sent) {
      deps.log('error', 'verification_email_failed', { cause: sent.cause ?? 'unknown' })
    }
  } catch (error) {
    deps.log('error', 'verification_email_failed', { cause: errorCause(error) })
  }

  return jsonResponse({ verificationEmailSent }, 201, origin)
}
