// T029 (spec 005, FR-022, FR-024, FR-025): las mismas reglas que la base, para ver el error al escribir.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import {
  emptyExerciseForm,
  exerciseFormSchema,
  parseAliases,
  type ExerciseFormInput,
} from '../../src/features/exercises/schema'

const e = es.exercises.errors

const valid = (overrides: Partial<ExerciseFormInput> = {}): ExerciseFormInput => ({
  ...emptyExerciseForm(),
  name: 'Plancha',
  measurement_type: 'duration',
  ...overrides,
})

const messages = (input: ExerciseFormInput) => {
  const result = exerciseFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('lo obligatorio', () => {
  it('solo el nombre y el tipo bastan; todo lo demás queda vacío (sin dato)', () => {
    expect(exerciseFormSchema.parse(valid())).toEqual({
      name: 'Plancha',
      measurement_type: 'duration',
      primary_muscles: [],
      secondary_muscles: [],
      equipment: null,
      description: null,
      aliases: [],
    })
  })

  it('el nombre se recorta y no puede estar vacío ni ser de solo espacios', () => {
    expect(exerciseFormSchema.parse(valid({ name: '  Plancha lateral  ' })).name).toBe(
      'Plancha lateral',
    )
    expect(messages(valid({ name: '' }))).toEqual([`name: ${e.nameRequired}`])
    expect(messages(valid({ name: '    ' }))).toEqual([`name: ${e.nameRequired}`])
  })

  it('el nombre admite hasta 120 caracteres', () => {
    expect(messages(valid({ name: 'a'.repeat(120) }))).toEqual([])
    expect(messages(valid({ name: 'a'.repeat(121) }))).toEqual([`name: ${e.nameTooLong}`])
  })

  it('el tipo de medición es obligatorio', () => {
    expect(messages(valid({ measurement_type: '' }))).toEqual([
      `measurement_type: ${e.measurementRequired}`,
    ])
  })

  it.each(['reps_weight', 'reps_bodyweight', 'duration', 'distance_duration'] as const)(
    'acepta el tipo %s',
    (type) => {
      expect(exerciseFormSchema.parse(valid({ measurement_type: type })).measurement_type).toBe(
        type,
      )
    },
  )
})

describe('músculos y equipamiento (listas cerradas)', () => {
  it('hasta 5 principales y 10 secundarios', () => {
    expect(
      messages(valid({ primary_muscles: ['chest', 'lats', 'traps', 'neck', 'calves'] })),
    ).toEqual([])
    expect(
      messages(valid({ primary_muscles: ['chest', 'lats', 'traps', 'neck', 'calves', 'biceps'] })),
    ).toEqual([`primary_muscles: ${e.tooManyPrimary}`])
    expect(
      messages(
        valid({
          secondary_muscles: [
            'chest',
            'lats',
            'traps',
            'neck',
            'calves',
            'biceps',
            'triceps',
            'glutes',
            'forearms',
            'abdominals',
            'quadriceps',
          ],
        }),
      ),
    ).toEqual([`secondary_muscles: ${e.tooManySecondary}`])
  })

  it('un músculo no puede ser principal y secundario a la vez', () => {
    expect(
      messages(valid({ primary_muscles: ['chest'], secondary_muscles: ['chest', 'triceps'] })),
    ).toEqual([`secondary_muscles: ${e.muscleRepeated}`])
  })

  it('un músculo o un equipamiento fuera de la lista se rechaza', () => {
    expect(messages(valid({ primary_muscles: ['pecho'] })).length).toBe(1)
    expect(messages(valid({ equipment: 'pesas' })).length).toBe(1)
  })

  it('«sin dato» en el equipamiento (texto vacío) es nulo', () => {
    expect(exerciseFormSchema.parse(valid({ equipment: '' })).equipment).toBeNull()
    expect(exerciseFormSchema.parse(valid({ equipment: 'body only' })).equipment).toBe('body only')
  })
})

describe('descripción', () => {
  it('se recorta; en blanco es «sin descripción»; admite hasta 4.000 caracteres', () => {
    expect(
      exerciseFormSchema.parse(valid({ description: '  1. Sube.\n2. Baja.  ' })).description,
    ).toBe('1. Sube.\n2. Baja.')
    expect(exerciseFormSchema.parse(valid({ description: '   ' })).description).toBeNull()
    expect(messages(valid({ description: 'a'.repeat(4000) }))).toEqual([])
    expect(messages(valid({ description: 'a'.repeat(4001) }))).toEqual([
      `description: ${e.descriptionTooLong}`,
    ])
  })
})

describe('otros nombres', () => {
  it('se separan por línea o por coma, se recortan y no se repiten', () => {
    expect(parseAliases('Remo elástico, Remo con goma\n  remo elastico \n\n')).toEqual([
      'Remo elástico',
      'Remo con goma',
    ])
  })

  it('se descarta el que es igual al nombre', () => {
    expect(
      exerciseFormSchema.parse(valid({ name: 'Plancha', aliases: 'plancha\nPlank' })).aliases,
    ).toEqual(['Plank'])
  })

  it('hasta 5, cada uno de hasta 80 caracteres', () => {
    expect(messages(valid({ aliases: 'a1,a2,a3,a4,a5' }))).toEqual([])
    expect(messages(valid({ aliases: 'a1,a2,a3,a4,a5,a6' }))).toEqual([
      `aliases: ${e.tooManyAliases}`,
    ])
    expect(messages(valid({ aliases: 'a'.repeat(81) }))).toEqual([`aliases: ${e.aliasTooLong}`])
  })
})
