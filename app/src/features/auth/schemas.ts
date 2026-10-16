import { z } from 'zod'
import { es } from '../../copy/es'
import { isValidPassword } from '../../lib/password'

const email = z
  .string()
  .trim()
  .pipe(z.email({ error: es.common.emailInvalid }))
const password = z.string().refine(isValidPassword, { error: es.errors.weakPassword })

export const registerSchema = z.object({
  email,
  password,
  // FR-029: la casilla del aviso es obligatoria.
  acceptPrivacy: z.boolean().refine((v) => v === true, { error: es.auth.privacyRequired }),
})
export type RegisterValues = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email,
  // En el ingreso solo se exige que no esté vacía: el servidor decide si es correcta.
  password: z.string().min(1, { error: es.errors.invalidCredentials }),
})
export type LoginValues = z.infer<typeof loginSchema>

export const recoverSchema = z.object({ email })
export type RecoverValues = z.infer<typeof recoverSchema>

export const resetSchema = z
  .object({ newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    error: es.common.passwordMismatch,
  })
export type ResetValues = z.infer<typeof resetSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: es.auth.currentPasswordWrong }),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    error: es.common.passwordMismatch,
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
