// Validación de entradas compartida por las Edge Functions (FR-002).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_EMAIL_LENGTH = 254
const MIN_PASSWORD_LENGTH = 10
const MAX_PASSWORD_BYTES = 72 // límite de bcrypt

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_EMAIL_LENGTH &&
    !value.includes('..') &&
    EMAIL.test(value)
  )
}

export function isValidPassword(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const bytes = new TextEncoder().encode(value).length
  return [...value].length >= MIN_PASSWORD_LENGTH && bytes <= MAX_PASSWORD_BYTES
}
