import { PRIVACY_NOTICE_VERSION } from '../../copy/privacy-notice'
import { supabase } from '../../lib/supabase'
import { AuthFlowError, toAuthFlowError } from './errors'

/** Inicia sesión y reinicia el contador de inactividad (FR-003). */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw await toAuthFlowError(error, 'login')

  // start_session solo acepta un inicio de sesión con contraseña reciente (claim `amr`).
  const { error: sessionError } = await supabase.rpc('start_session')
  if (sessionError) throw await toAuthFlowError(sessionError, 'login')
}

/** Crea la cuenta con la Edge Function `register` y después inicia sesión. */
export async function registerAccount(input: {
  email: string
  password: string
  turnstileToken: string
}): Promise<{ verificationEmailSent: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ verificationEmailSent: boolean }>(
    'register',
    {
      body: {
        email: input.email,
        password: input.password,
        turnstileToken: input.turnstileToken,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      },
    },
  )
  if (error) throw await toAuthFlowError(error, 'register')

  await signIn(input.email, input.password)
  return { verificationEmailSent: data?.verificationEmailSent ?? false }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw await toAuthFlowError(error)
}

/** Pide el enlace de recuperación. La respuesta es la misma exista o no la cuenta (FR-005). */
export async function requestPasswordReset(input: {
  email: string
  turnstileToken: string
}): Promise<void> {
  const { error } = await supabase.functions.invoke('request-password-reset', { body: input })
  if (error) throw await toAuthFlowError(error, 'recover')
}

/** Fija la contraseña desde un enlace de recuperación y cierra todas las sesiones (FR-030). */
export async function resetPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw await toAuthFlowError(error)
  await supabase.auth.signOut({ scope: 'global' })
}

/**
 * Cambia la contraseña con sesión iniciada (FR-028): primero reautentica con la actual y recién
 * después actualiza. Cierra las demás sesiones y mantiene la actual (FR-030).
 */
export async function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email) throw new AuthFlowError({ code: 'session_not_found', status: 401 })

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  })
  if (reauthError) throw await toAuthFlowError(reauthError)

  const { error } = await supabase.auth.updateUser({ password: input.newPassword })
  if (error) throw await toAuthFlowError(error)

  await supabase.auth.signOut({ scope: 'others' })
}

/** Reenvía el enlace de confirmación del correo (FR-026). */
export async function resendVerification(): Promise<void> {
  const { error } = await supabase.functions.invoke('send-verification')
  if (error) throw await toAuthFlowError(error)
}
