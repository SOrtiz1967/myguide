import { describe, expect, it } from 'vitest'
import {
  currentEntry,
  profileGoalFor,
  sleepHours,
  topGoal,
  validateAvailability,
  validateGoals,
  withPriorities,
  type AthleteGoal,
} from '../../src/features/athlete/athlete'

describe('profileGoalFor', () => {
  it('mapea a los objetivos de la spec 014 solo cuando hay equivalente', () => {
    expect(profileGoalFor('hypertrophy')).toBe('muscle_gain')
    expect(profileGoalFor('gradual_fat_loss')).toBe('fat_loss')
    expect(profileGoalFor('recomposition')).toBe('recomposition')
    expect(profileGoalFor('strength')).toBeNull()
    expect(profileGoalFor('custom')).toBeNull()
  })
})

describe('validateGoals', () => {
  const goal = (kind: AthleteGoal['kind'], priority: 1 | 2 | 3, label?: string): AthleteGoal => ({
    kind,
    priority,
    ...(label === undefined ? {} : { label }),
  })

  it('acepta de 1 a 3 objetivos con prioridades distintas', () => {
    expect(validateGoals([goal('hypertrophy', 1)])).toBeNull()
    expect(
      validateGoals([goal('hypertrophy', 1), goal('strength', 2), goal('fitness', 3)]),
    ).toBeNull()
  })

  it('rechaza lista vacía, más de 3, tipos repetidos y prioridades repetidas', () => {
    expect(validateGoals([])).toBe('empty')
    expect(
      validateGoals([
        goal('hypertrophy', 1),
        goal('strength', 2),
        goal('fitness', 3),
        goal('maintenance', 3),
      ]),
    ).toBe('too_many')
    expect(validateGoals([goal('strength', 1), goal('strength', 2)])).toBe('repeated_kind')
    expect(validateGoals([goal('strength', 1), goal('fitness', 1)])).toBe('repeated_priority')
  })

  it('exige texto de 1 a 60 caracteres en el objetivo personalizado', () => {
    expect(validateGoals([goal('custom', 1)])).toBe('label_required')
    expect(validateGoals([goal('custom', 1, '   ')])).toBe('label_required')
    expect(validateGoals([goal('custom', 1, 'x'.repeat(61))])).toBe('label_too_long')
    expect(validateGoals([goal('custom', 1, 'Correr 10 km')])).toBeNull()
  })

  it('permite más de un objetivo personalizado', () => {
    expect(validateGoals([goal('custom', 1, 'A'), goal('custom', 2, 'B')])).toBeNull()
  })
})

describe('withPriorities', () => {
  it('numera según el orden y recorta el texto solo en los personalizados', () => {
    expect(
      withPriorities([
        { kind: 'strength' },
        { kind: 'custom', label: '  Correr  ' },
        { kind: 'fitness', label: 'ignorado' },
      ]),
    ).toEqual([
      { kind: 'strength', priority: 1 },
      { kind: 'custom', priority: 2, label: 'Correr' },
      { kind: 'fitness', priority: 3 },
    ])
  })
})

describe('topGoal', () => {
  it('devuelve el de prioridad 1 o nulo', () => {
    expect(topGoal([{ kind: 'strength', priority: 2 }])).toBeNull()
    expect(topGoal([{ kind: 'fitness', priority: 1 }])?.kind).toBe('fitness')
  })
})

describe('currentEntry', () => {
  const rows = [
    { effective_from: '2026-12-10', id: 'futuro' },
    { effective_from: '2026-11-20', id: 'vigente' },
    { effective_from: '2026-10-01', id: 'viejo' },
  ]
  it('toma el primero (más nuevo) cuya vigencia ya empezó', () => {
    expect(currentEntry(rows, '2026-11-26')?.id).toBe('vigente')
    expect(currentEntry(rows, '2026-12-10')?.id).toBe('futuro')
  })
  it('devuelve nulo si todavía no rige ninguno', () => {
    expect(currentEntry(rows, '2026-09-01')).toBeNull()
    expect(currentEntry([], '2026-11-26')).toBeNull()
  })
})

describe('sleepHours', () => {
  it('convierte minutos a horas con un decimal y respeta la ausencia de dato', () => {
    expect(sleepHours(450)).toBe(7.5)
    expect(sleepHours(null)).toBeNull()
  })
})

describe('validateAvailability', () => {
  const base = {
    days_per_week: 3,
    session_minutes: 60,
    usual_time: null,
    place: null,
    equipment: [],
  } as const
  it('acepta valores en rango y la duración ausente', () => {
    expect(validateAvailability({ ...base, equipment: [] })).toBeNull()
    expect(validateAvailability({ ...base, equipment: [], session_minutes: null })).toBeNull()
  })
  it('rechaza más días de los que tiene la semana y duraciones fuera de 15 a 240', () => {
    expect(validateAvailability({ ...base, equipment: [], days_per_week: 8 })).toBe('days')
    expect(validateAvailability({ ...base, equipment: [], days_per_week: 0 })).toBe('days')
    expect(validateAvailability({ ...base, equipment: [], session_minutes: 10 })).toBe('minutes')
    expect(validateAvailability({ ...base, equipment: [], session_minutes: 241 })).toBe('minutes')
  })
})
