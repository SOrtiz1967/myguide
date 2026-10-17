import type { Profile, ProfileUpdate } from './api'

/** Fecha de nacimiento, altura y zona horaria son obligatorias para considerar el perfil completo; el sexo es opcional. */
export function isProfileComplete(profile: Profile): boolean {
  return Boolean(profile.birth_date) && profile.height_cm !== null && Boolean(profile.timezone)
}

/** Los valores editables del perfil, tal como están guardados. */
export function toProfileUpdate(profile: Profile): ProfileUpdate {
  return {
    birth_date: profile.birth_date,
    sex: profile.sex,
    height_cm: profile.height_cm,
    timezone: profile.timezone,
  }
}

/** Valores iniciales del formulario (todo texto; la altura con coma decimal regional). */
export function toFormValues(profile: Profile) {
  return {
    birthDate: profile.birth_date ?? '',
    sex: profile.sex ?? '',
    heightCm: profile.height_cm === null ? '' : String(profile.height_cm).replace('.', ','),
    timezone: profile.timezone ?? '',
  } as const
}
