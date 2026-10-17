import { adminClient } from '../_shared/admin.ts'
import { log } from '../_shared/log.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'
import { rateLimiter, verificationSender } from '../_shared/wiring.ts'
import { type CreateAccountResult, handleRegister } from './handler.ts'

const admin = adminClient()

async function createAccount(input: {
  email: string
  password: string
  privacyNoticeVersion: string
}): Promise<CreateAccountResult> {
  // Se valida antes de crear: si fallara el disparador, GoTrue solo devuelve un error genérico.
  const { data: current, error: versionError } = await admin.rpc('is_privacy_notice_current', {
    p_version: input.privacyNoticeVersion,
  })
  if (versionError) return { status: 'error', cause: 'privacy_check_failed' }
  if (!current) return { status: 'invalid_privacy_version' }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // la confirmación propia no es bloqueante (FR-026)
    user_metadata: { privacy_notice_version: input.privacyNoticeVersion },
  })

  if (error) {
    if (error.code === 'email_exists' || /already (been )?registered/i.test(error.message)) {
      return { status: 'exists' }
    }
    return { status: 'error', cause: error.code ?? 'create_user_failed' }
  }
  return { status: 'created', userId: data.user.id }
}

Deno.serve((req) =>
  handleRegister(req, {
    rateLimit: rateLimiter(admin, 10, '1 hour'),
    verifyTurnstile: (token, ip) =>
      verifyTurnstile({
        secret: Deno.env.get('TURNSTILE_SECRET_KEY') ?? '',
        token,
        ip,
      }),
    createAccount,
    sendVerification: verificationSender(admin),
    log,
  })
)
