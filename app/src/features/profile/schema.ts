import { z } from 'zod'
import { es } from '../../copy/es'
import { isValidTimezone } from '../../lib/timezone'
import type { ProfileUpdate } from './api'

// Las mismas reglas que las restricciones de la base de datos (migración 000800), para que el
// usuario vea el error al escribir y no recién al guardar.

const MIN_HEIGHT_CM = 50
const MAX_HEIGHT_CM = 250
const MAX_AGE_YEARS = 120

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function isReasonableBirthDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const real = new Date(Date.UTC(year, month - 1, day))
  const isRealDate =
    real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day
  if (!isRealDate) return false

  const today = new Date()
  const oldest = new Date(today)
  oldest.setFullYear(today.getFullYear() - MAX_AGE_YEARS)
  // Las fechas ISO se comparan como texto.
  return value <= toIso(today) && value >= toIso(oldest)
}

/** '171,5' o '171.5' → 171.5. Devuelve null si no es una altura válida (50 a 250 cm, un decimal). */
export function parseHeight(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d)?$/.test(normalized)) return null
  const height = Number(normalized)
  return height >= MIN_HEIGHT_CM && height <= MAX_HEIGHT_CM ? height : null
}

export const profileFormSchema = z
  .object({
    birthDate: z
      .string()
      .refine((v) => v === '' || isReasonableBirthDate(v), { error: es.profile.errors.birthDate }),
    sex: z.enum(['', 'female', 'male'], { error: es.profile.errors.sex }),
    heightCm: z.string().refine((v) => v.trim() === '' || parseHeight(v) !== null, {
      error: es.profile.errors.height,
    }),
    timezone: z
      .string()
      .refine((v) => v === '' || isValidTimezone(v), { error: es.profile.errors.timezone }),
  })
  .transform((v): ProfileUpdate => ({
    birth_date: v.birthDate === '' ? null : v.birthDate,
    sex: v.sex === '' ? null : v.sex,
    height_cm: v.heightCm.trim() === '' ? null : parseHeight(v.heightCm),
    timezone: v.timezone === '' ? null : v.timezone,
  }))

export type ProfileFormInput = z.input<typeof profileFormSchema>
