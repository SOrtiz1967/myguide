// T030 (FR-026): confirmación del correo con un token de un solo uso.
// Vencido, usado o inexistente se tratan igual: la causa no se revela.
import { errorCause } from '../_shared/errors.ts'
import type { LogFn } from '../_shared/log.ts'

export interface ConfirmEmailDeps {
  siteUrl: string
  hashToken(token: string): Promise<string>
  /** Atómico: marca el token como usado solo si existe, no venció y no se usó. */
  consumeToken(hash: string): Promise<{ userId: string } | null>
  markVerified(userId: string): Promise<void>
  log: LogFn
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } })
}

export async function handleConfirmEmail(req: Request, deps: ConfirmEmailDeps): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ code: 'method_not_allowed' }), { status: 405 })
  }

  const invalid = redirect(`${deps.siteUrl}/correo-no-valido`)
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return invalid

  try {
    const consumed = await deps.consumeToken(await deps.hashToken(token))
    if (!consumed) return invalid
    await deps.markVerified(consumed.userId)
    return redirect(`${deps.siteUrl}/correo-confirmado`)
  } catch (error) {
    deps.log('error', 'confirm_email_failed', { cause: errorCause(error) })
    return invalid
  }
}
