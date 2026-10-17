import { useState } from 'react'
import { es } from '../../copy/es'
import { toUserMessage } from '../../lib/errors'
import { useProfile } from '../profile/useProfile'
import { resendVerification } from './api'
import { toAuthFlowError } from './errors'

type Notice = { kind: 'ok' | 'error'; text: string }

const KNOWN_CODES: Record<string, string> = {
  too_soon: es.auth.verifyTooSoon,
  daily_limit: es.auth.verifyDailyLimit,
  email_unavailable: es.auth.verifyEmailNotSent,
}

/**
 * Recordatorio visible mientras el correo no esté confirmado (FR-026). La cuenta se puede usar sin
 * confirmarlo; solo la recuperación de contraseña exige el correo confirmado (FR-027).
 */
export function VerifyEmailBanner() {
  const { data: profile, isLoading } = useProfile()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  if (isLoading || !profile || profile.email_verified_at) return null

  async function resend() {
    setBusy(true)
    setNotice(null)
    try {
      await resendVerification()
      setNotice({ kind: 'ok', text: es.auth.verifyResent })
    } catch (e) {
      const error = await toAuthFlowError(e)
      setNotice({
        kind: 'error',
        text: (error.code && KNOWN_CODES[error.code]) || toUserMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Confirmación del correo"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <p>{es.auth.verifyBanner}</p>
      <div>
        <button type="button" className="btn-secondary" onClick={resend} disabled={busy}>
          {es.auth.actions.resend}
        </button>
      </div>
      {notice?.kind === 'ok' ? (
        <p role="status" className="text-success">
          {notice.text}
        </p>
      ) : null}
      {notice?.kind === 'error' ? (
        <p role="alert" className="text-danger">
          {notice.text}
        </p>
      ) : null}
    </section>
  )
}
