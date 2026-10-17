// T051 (FR-013, FR-014, FR-017): validación del perfil, con las mismas reglas que la base de datos.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { profileFormSchema } from '../../src/features/profile/schema'

function isoOffset(days: number, years = 0): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const valid = {
  birthDate: '1990-05-17',
  sex: 'female',
  heightCm: '171.5',
  timezone: 'America/Argentina/Buenos_Aires',
}

const parse = (overrides: Record<string, string> = {}) =>
  profileFormSchema.safeParse({ ...valid, ...overrides })

describe('profileFormSchema', () => {
  it('acepta valores válidos y los convierte al formato de la base de datos', () => {
    const result = parse()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      birth_date: '1990-05-17',
      sex: 'female',
      height_cm: 171.5,
      timezone: 'America/Argentina/Buenos_Aires',
    })
  })

  it('FR-017: los campos vacíos quedan como no informados (null), sin valores supuestos', () => {
    const result = parse({ birthDate: '', sex: '', heightCm: '', timezone: '' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ birth_date: null, sex: null, height_cm: null, timezone: null })
  })

  it('FR-014: rechaza una fecha de nacimiento futura', () => {
    const result = parse({ birthDate: isoOffset(1) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(es.profile.errors.birthDate)
  })

  it('FR-014: la fecha de hoy es válida y la de hace más de 120 años no', () => {
    expect(parse({ birthDate: isoOffset(0) }).success).toBe(true)
    expect(parse({ birthDate: isoOffset(-1, -120) }).success).toBe(false)
    expect(parse({ birthDate: isoOffset(0, -120) }).success).toBe(true)
  })

  it('FR-014: rechaza fechas con formato inválido o inexistentes', () => {
    expect(parse({ birthDate: '17/05/1990' }).success).toBe(false)
    expect(parse({ birthDate: '1990-02-31' }).success).toBe(false)
    expect(parse({ birthDate: 'ayer' }).success).toBe(false)
  })

  it('FR-014: la altura debe estar entre 50 y 250 cm', () => {
    expect(parse({ heightCm: '49.9' }).success).toBe(false)
    expect(parse({ heightCm: '250.1' }).success).toBe(false)
    expect(parse({ heightCm: '50' }).success).toBe(true)
    expect(parse({ heightCm: '250' }).success).toBe(true)
    expect(parse({ heightCm: '-170' }).success).toBe(false)
    expect(parse({ heightCm: 'alto' }).success).toBe(false)
  })

  it('FR-014: la altura admite coma decimal (formato regional) y un solo decimal', () => {
    expect(parse({ heightCm: '171,5' }).data?.height_cm).toBe(171.5)
    expect(parse({ heightCm: '171.55' }).success).toBe(false)
  })

  it('FR-014: el mensaje de altura nombra el rango y la unidad', () => {
    const result = parse({ heightCm: '30' })
    expect(result.error?.issues[0]?.message).toBe(es.profile.errors.height)
    expect(es.profile.errors.height).toMatch(/50.*250.*cm/)
  })

  it('FR-013: el sexo admite female, male o no informado, y nada más', () => {
    expect(parse({ sex: 'male' }).success).toBe(true)
    expect(parse({ sex: '' }).success).toBe(true)
    expect(parse({ sex: 'otro' }).success).toBe(false)
  })

  it('FR-014: rechaza una zona horaria inexistente', () => {
    const result = parse({ timezone: 'Marte/Fobos' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(es.profile.errors.timezone)
  })
})
