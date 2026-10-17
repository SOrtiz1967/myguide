// FR-002: la contraseña tiene entre 10 caracteres y 72 bytes (límite de bcrypt).
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_BYTES = 72

export function isValidPassword(value: string): boolean {
  const length = [...value].length
  const bytes = new TextEncoder().encode(value).length
  return length >= PASSWORD_MIN_LENGTH && bytes <= PASSWORD_MAX_BYTES
}
