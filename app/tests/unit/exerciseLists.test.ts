// T012 (spec 005, FR-014, FR-024): las listas cerradas del catálogo de ejercicios, con su español, y
// que coinciden con las restricciones de la base de datos.
import { describe, expect, it } from 'vitest'
// La migración de la tabla, como texto (Vite la entrega con `?raw`). Si se renombra, esta importación falla.
import migration from '../../../supabase/migrations/20261021000100_exercise_tables.sql?raw'
import {
  EQUIPMENT,
  MEASUREMENT_TYPES,
  MUSCLES,
  equipmentLabel,
  measurementLabel,
  muscleLabel,
} from '../../src/features/exercises/exerciseLists'

/** Los códigos entre comillas de una restricción `check` de la migración. */
function codesIn(constraint: string): string[] {
  const sql = migration
  const start = sql.indexOf(`constraint ${constraint}`)
  if (start === -1) throw new Error(`La migración no define la restricción ${constraint}`)
  const end = sql.indexOf('\n  ),', start)
  const block = sql.slice(start, end === -1 ? undefined : end)
  return [...block.matchAll(/'([^']+)'/g)]
    .map((m) => m[1]!)
    .filter((c) => !/^(imported|own)$/.test(c))
}

describe('tipos de medición', () => {
  it('son los cuatro de la spec, con su nombre en español', () => {
    expect([...MEASUREMENT_TYPES]).toEqual([
      'reps_weight',
      'reps_bodyweight',
      'duration',
      'distance_duration',
    ])
    expect(measurementLabel('reps_weight')).toBe('Repeticiones y peso')
    expect(measurementLabel('reps_bodyweight')).toBe('Repeticiones (peso corporal)')
    expect(measurementLabel('duration')).toBe('Tiempo')
    expect(measurementLabel('distance_duration')).toBe('Distancia y tiempo')
  })

  it('coinciden con la base', () => {
    expect(codesIn('exercises_measurement_check').sort()).toEqual([...MEASUREMENT_TYPES].sort())
  })
})

describe('músculos', () => {
  it('son 18, sin repetidos, cada uno con su nombre en español', () => {
    expect(MUSCLES).toHaveLength(18)
    expect(new Set(MUSCLES).size).toBe(18)
    const names = MUSCLES.map(muscleLabel)
    expect(new Set(names).size).toBe(18)
    for (const name of names) expect(name.trim()).not.toBe('')
  })

  it('usan los nombres de research.md (Decisión 5)', () => {
    expect(muscleLabel('abdominals')).toBe('Abdominales')
    expect(muscleLabel('lower back')).toBe('Zona lumbar')
    expect(muscleLabel('middle back')).toBe('Espalda media')
    expect(muscleLabel('lats')).toBe('Dorsales')
    expect(muscleLabel('quadriceps')).toBe('Cuádriceps')
    expect(muscleLabel('hamstrings')).toBe('Isquiotibiales')
    expect(muscleLabel('full_body')).toBe('Cuerpo completo')
  })

  it('coinciden con la base, en los principales y en los secundarios', () => {
    expect(codesIn('exercises_primary_muscles_check').sort()).toEqual([...MUSCLES].sort())
    expect(codesIn('exercises_secondary_muscles_check').sort()).toEqual([...MUSCLES].sort())
  })
})

describe('equipamiento', () => {
  it('son 12, sin repetidos, cada uno con su nombre en español', () => {
    expect(EQUIPMENT).toHaveLength(12)
    expect(new Set(EQUIPMENT).size).toBe(12)
    expect(new Set(EQUIPMENT.map(equipmentLabel)).size).toBe(12)
  })

  it('usan los nombres de research.md (Decisión 5)', () => {
    expect(equipmentLabel('body only')).toBe('Peso corporal')
    expect(equipmentLabel('barbell')).toBe('Barra')
    expect(equipmentLabel('dumbbell')).toBe('Mancuernas')
    expect(equipmentLabel('cable')).toBe('Polea')
    expect(equipmentLabel('kettlebells')).toBe('Pesa rusa')
    expect(equipmentLabel('e-z curl bar')).toBe('Barra Z')
    expect(equipmentLabel('other')).toBe('Otro')
  })

  it('coinciden con la base', () => {
    expect(codesIn('exercises_equipment_check').sort()).toEqual([...EQUIPMENT].sort())
  })
})
