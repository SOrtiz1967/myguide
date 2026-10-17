// T029 (FR-026): emisión del enlace de confirmación del correo.
import { jsonResponse } from '../_shared/cors.ts'
import { errorCause } from '../_shared/errors.ts'
import type { LogFn } from '../_shared/log.ts'
import { methodNotAllowed, preflight } from '../_shared/request.ts'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const MIN_RESEND_MS = 60 * 1000
const MAX_PER_DAY = 5

export interface SendVerificationDeps {
  now(): Date
  siteUrl: string
  functionsUrl: string
  getUser(
    authorization: string | null,
  ): Promise<{ id: string; email: string; emailVerified: boolean } | null>
  lastTokenAt(userId: string): Promise<Date | null>
  tokensInLastDay(userId: string): Promise<number>
  /** Invalida los tokens pendientes, guarda el hash del nuevo y devuelve el token en claro. */
  createToken(userId: string, expiresAt: Date): Promise<string>
  sendMail(input: { to: string; link: string }): Promise<void>
  log: LogFn
}

export async function handleSendVerification(
  req: Request,
  deps: SendVerificationDeps,
): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return methodNotAllowed(req)

  const user = await deps.getUser(req.headers.get('authorization'))
  if (!user) return jsonResponse({ code: 'unauthorized' }, 401, origin)
  if (user.emailVerified) return jsonResponse({ code: 'already_verified' }, 409, origin)

  const now = deps.now()
  const last = await deps.lastTokenAt(user.id)
  if (last && now.getTime() - last.getTime() < MIN_RESEND_MS) {
    return jsonResponse({ code: 'too_soon' }, 429, origin)
  }
  if ((await deps.tokensInLastDay(user.id)) >= MAX_PER_DAY) {
    return jsonResponse({ code: 'daily_limit' }, 429, origin)
  }

  const token = await deps.createToken(user.id, new Date(now.getTime() + TOKEN_TTL_MS))
  const link = `${deps.functionsUrl}/confirm-email?token=${encodeURIComponent(token)}`

  try {
    await deps.sendMail({ to: user.email, link })
  } catch (error) {
    deps.log('error', 'verification_email_failed', { cause: errorCause(error) })
    return jsonResponse({ code: 'email_unavailable' }, 502, origin)
  }
  return new Response(null, { status: 204, headers: { Vary: 'Origin' } })
}
