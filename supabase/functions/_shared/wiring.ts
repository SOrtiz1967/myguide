// Conexión de los manejadores con servicios reales (base de datos, correo). Es "cableado" fino:
// la lógica probada vive en cada handler.ts. Solo se importa desde los index.ts de las funciones.
import type { SupabaseClient } from '@supabase/supabase-js'
import { errorCause } from './errors.ts'
import { log } from './log.ts'
import { buildVerificationMail, sendMail } from './mail.ts'
import { generateToken, hashToken } from './tokens.ts'

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export function siteUrl(): string {
  return Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
}

/** URL pública de las funciones, la que aparece en los enlaces de los correos. */
export function functionsUrl(): string {
  return Deno.env.get('FUNCTIONS_URL') ?? `${Deno.env.get('SUPABASE_URL')}/functions/v1`
}

/**
 * Límite de solicitudes por clave (por ejemplo, por IP). Si la base de datos falla, deja pasar
 * y lo registra: el límite es una defensa adicional y su caída no debe bloquear a las personas.
 */
export function rateLimiter(admin: SupabaseClient, max: number, windowText: string) {
  return async (key: string): Promise<boolean> => {
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window: windowText,
    })
    if (error) {
      log('error', 'rate_limit_check_failed', { cause: 'database_error' })
      return true
    }
    return data === true
  }
}

/** Guarda el hash del token (invalidando los pendientes) y devuelve el token en claro. */
export async function issueVerificationToken(
  admin: SupabaseClient,
  userId: string,
  expiresAt: Date,
): Promise<string> {
  const token = generateToken()
  const { error } = await admin.rpc('issue_email_token', {
    p_user_id: userId,
    p_token_hash: await hashToken(token),
    p_expires_at: expiresAt.toISOString(),
  })
  if (error) throw new Error('issue_email_token_failed')
  return token
}

export async function sendVerificationMail(to: string, link: string): Promise<void> {
  await sendMail({ to, ...buildVerificationMail(link) })
}

/** Emite el token y envía el correo de confirmación. Nunca lanza: informa si se envió o por qué no. */
export function verificationSender(admin: SupabaseClient) {
  return async (userId: string, email: string): Promise<{ sent: boolean; cause?: string }> => {
    try {
      const token = await issueVerificationToken(
        admin,
        userId,
        new Date(Date.now() + VERIFICATION_TTL_MS),
      )
      await sendVerificationMail(
        email,
        `${functionsUrl()}/confirm-email?token=${encodeURIComponent(token)}`,
      )
      return { sent: true }
    } catch (error) {
      return { sent: false, cause: errorCause(error) }
    }
  }
}
