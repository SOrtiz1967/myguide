// T010 (spec 006, FR-002, FR-028, FR-031, FR-032): esquemas de rutinas y sesiones, con los mismos límites que la base.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import {
  buildSessionPayload,
  emptySetInput,
  parseSet,
  routineFormSchema,
  type RoutineFormInput,
  type SessionDraft,
  type SessionExerciseDraft,
} from '../../src/features/training/schema'

const v = es.training.validation

describe('parseSet: una serie según el tipo de medición (FR-028, FR-030, FR-031)', () => {
  it('repeticiones y peso, con coma decimal', () => {
    const r = parseSet('reps_weight', { ...emptySetInput(), reps: '8', weight_kg: '62,5' })
    expect(r.errors).toEqual({})
    expect(r.empty).toBe(false)
    expect(r.values).toEqual({ reps: 8, weight_kg: 62.5, duration_s: null, distance_km: null })
  })

  it('un dato sin completar queda como ausente, no como 0 (FR-030)', () => {
    const r = parseSet('reps_weight', { ...emptySetInput(), reps: '8' })
    expect(r.errors).toEqual({})
    expect(r.values.weight_kg).toBeNull()
  })

  it('un peso de 0 es válido y distinto de ausente', () => {
    const r = parseSet('reps_weight', { ...emptySetInput(), reps: '5', weight_kg: '0' })
    expect(r.errors).toEqual({})
    expect(r.values.weight_kg).toBe(0)
  })

  it('una serie sin ningún valor está vacía y no es un error (no se guarda)', () => {
    const r = parseSet('reps_weight', emptySetInput())
    expect(r.empty).toBe(true)
    expect(r.errors).toEqual({})
  })

  it('repeticiones fuera de rango o no enteras', () => {
    expect(parseSet('reps_weight', { ...emptySetInput(), reps: '0' }).errors.reps).toBe(v.reps)
    expect(parseSet('reps_weight', { ...emptySetInput(), reps: '1000' }).errors.reps).toBe(v.reps)
    expect(parseSet('reps_weight', { ...emptySetInput(), reps: '2,5' }).errors.reps).toBe(v.reps)
    expect(parseSet('reps_weight', { ...emptySetInput(), reps: 'abc' }).errors.reps).toBe(v.number)
    expect(parseSet('reps_weight', { ...emptySetInput(), reps: '999' }).errors).toEqual({})
  })

  it('peso fuera de rango', () => {
    expect(parseSet('reps_weight', { ...emptySetInput(), weight_kg: '-1' }).errors.weight_kg).toBe(
      v.number,
    )
    expect(
      parseSet('reps_weight', { ...emptySetInput(), weight_kg: '1000' }).errors.weight_kg,
    ).toBe(v.weight)
    expect(parseSet('reps_weight', { ...emptySetInput(), weight_kg: '999,9' }).errors).toEqual({})
  })

  it('solo repeticiones en un ejercicio sin peso; el peso escrito se ignora', () => {
    const r = parseSet('reps_bodyweight', { ...emptySetInput(), reps: '12', weight_kg: '20' })
    expect(r.values).toEqual({ reps: 12, weight_kg: null, duration_s: null, distance_km: null })
  })

  it('tiempo: mm:ss y h:mm:ss, de 1 segundo a 24 horas', () => {
    expect(parseSet('duration', { ...emptySetInput(), duration: '1:30' }).values.duration_s).toBe(
      90,
    )
    expect(
      parseSet('duration', { ...emptySetInput(), duration: '1:05:30' }).values.duration_s,
    ).toBe(3930)
    expect(parseSet('duration', { ...emptySetInput(), duration: '0' }).errors.duration_s).toBe(
      v.duration,
    )
    expect(
      parseSet('duration', { ...emptySetInput(), duration: '24:00:01' }).errors.duration_s,
    ).toBe(v.duration)
    expect(parseSet('duration', { ...emptySetInput(), duration: '1:75' }).errors.duration_s).toBe(
      v.duration,
    )
  })

  it('distancia y tiempo; la distancia es mayor que 0 y hasta 999,9 km', () => {
    const r = parseSet('distance_duration', {
      ...emptySetInput(),
      distance_km: '5,25',
      duration: '30:00',
    })
    expect(r.errors).toEqual({})
    expect(r.values).toEqual({ reps: null, weight_kg: null, duration_s: 1800, distance_km: 5.25 })
    expect(
      parseSet('distance_duration', { ...emptySetInput(), distance_km: '0' }).errors.distance_km,
    ).toBe(v.distance)
    expect(
      parseSet('distance_duration', { ...emptySetInput(), distance_km: '1000' }).errors.distance_km,
    ).toBe(v.distance)
  })
})

function item(over: Partial<RoutineFormInput['exercises'][number]> = {}) {
  return {
    exercise_id: 'e1',
    exercise_name: 'Press de banca',
    measurement_type: 'reps_weight',
    sets: '3',
    target_reps: '',
    target_weight_kg: '',
    target_duration: '',
    target_distance_km: '',
    ...over,
  }
}

describe('routineFormSchema (FR-001, FR-002)', () => {
  const parse = (input: RoutineFormInput) => routineFormSchema.safeParse(input)
  const messages = (input: RoutineFormInput) => {
    const r = parse(input)
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  }

  it('una rutina válida se convierte en el payload del servidor', () => {
    const r = parse({
      name: '  Torso A  ',
      exercises: [
        item({ target_reps: '8', target_weight_kg: '60,5' }),
        item({
          exercise_id: 'e2',
          measurement_type: 'duration',
          sets: '2',
          target_duration: '1:00',
        }),
      ],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toEqual({
        name: 'Torso A',
        exercises: [
          {
            exercise_id: 'e1',
            sets: 3,
            target_reps: 8,
            target_weight_kg: 60.5,
            target_duration_s: null,
            target_distance_km: null,
          },
          {
            exercise_id: 'e2',
            sets: 2,
            target_reps: null,
            target_weight_kg: null,
            target_duration_s: 60,
            target_distance_km: null,
          },
        ],
      })
    }
  })

  it('nombre vacío, en blanco o de más de 80 caracteres', () => {
    expect(messages({ name: '', exercises: [item()] })).toContain(
      `name: ${es.training.errors.routine.name_required}`,
    )
    expect(messages({ name: '   ', exercises: [item()] })).toContain(
      `name: ${es.training.errors.routine.name_required}`,
    )
    expect(messages({ name: 'a'.repeat(81), exercises: [item()] })).toContain(
      `name: ${es.training.errors.routine.name_too_long}`,
    )
    expect(parse({ name: 'a'.repeat(80), exercises: [item()] }).success).toBe(true)
  })

  it('sin ejercicios o con más de 30', () => {
    expect(messages({ name: 'X', exercises: [] })).toContain(
      `exercises: ${es.training.errors.routine.exercises_required}`,
    )
    const many = Array.from({ length: 31 }, (_, i) => item({ exercise_id: `e${i}` }))
    expect(messages({ name: 'X', exercises: many })).toContain(
      `exercises: ${es.training.errors.routine.too_many_exercises}`,
    )
    expect(parse({ name: 'X', exercises: many.slice(0, 30) }).success).toBe(true)
  })

  it('series de 1 a 20', () => {
    for (const bad of ['0', '21', 'abc', '', '2,5']) {
      expect(messages({ name: 'X', exercises: [item({ sets: bad })] })).toContain(
        `exercises.0.sets: ${es.training.errors.routine.invalid_sets}`,
      )
    }
    expect(parse({ name: 'X', exercises: [item({ sets: '20' })] }).success).toBe(true)
  })

  it('los objetivos siguen el tipo de medición', () => {
    // una duración objetivo en un ejercicio con peso → no corresponde
    expect(messages({ name: 'X', exercises: [item({ target_duration: '1:00' })] })).toContain(
      `exercises.0.target_duration: ${es.training.errors.routine.invalid_target}`,
    )
    // repeticiones objetivo en un ejercicio de tiempo
    expect(
      messages({
        name: 'X',
        exercises: [item({ measurement_type: 'duration', target_reps: '10' })],
      }),
    ).toContain(`exercises.0.target_reps: ${es.training.errors.routine.invalid_target}`)
    // un peso objetivo en un ejercicio sin peso
    expect(
      messages({
        name: 'X',
        exercises: [item({ measurement_type: 'reps_bodyweight', target_weight_kg: '10' })],
      }),
    ).toContain(`exercises.0.target_weight_kg: ${es.training.errors.routine.invalid_target}`)
  })

  it('rangos de los objetivos; un peso objetivo de 0 es válido', () => {
    expect(messages({ name: 'X', exercises: [item({ target_reps: '0' })] })).toContain(
      `exercises.0.target_reps: ${v.reps}`,
    )
    expect(messages({ name: 'X', exercises: [item({ target_weight_kg: '1000' })] })).toContain(
      `exercises.0.target_weight_kg: ${v.weight}`,
    )
    expect(parse({ name: 'X', exercises: [item({ target_weight_kg: '0' })] }).success).toBe(true)
    expect(
      messages({
        name: 'X',
        exercises: [item({ measurement_type: 'distance_duration', target_distance_km: '0' })],
      }),
    ).toContain(`exercises.0.target_distance_km: ${v.distance}`)
  })
})

function exerciseDraft(over: Partial<SessionExerciseDraft> = {}): SessionExerciseDraft {
  return {
    id: 'x1',
    exercise_id: 'e1',
    exercise_name: 'Press de banca',
    measurement_type: 'reps_weight',
    plan_item_id: null,
    is_substitute: false,
    effort: '',
    note: '',
    sets: [{ ...emptySetInput(), reps: '8', weight_kg: '60' }],
    ...over,
  }
}

describe('buildSessionPayload (FR-013, FR-014, FR-028, FR-032)', () => {
  it('arma el payload con solo los valores presentes y descarta las series vacías', () => {
    const draft: SessionDraft = {
      note: '  Buena sesión  ',
      exercises: [
        exerciseDraft({
          effort: '7',
          note: ' pesado ',
          sets: [
            { ...emptySetInput(), reps: '8', weight_kg: '60' },
            emptySetInput(),
            { ...emptySetInput(), reps: '6' },
          ],
        }),
      ],
    }
    const r = buildSessionPayload(draft)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload).toEqual({
        note: 'Buena sesión',
        exercises: [
          {
            id: 'x1',
            exercise_id: 'e1',
            plan_item_id: null,
            is_substitute: false,
            effort: 7,
            note: 'pesado',
            sets: [{ reps: 8, weight_kg: 60 }, { reps: 6 }],
          },
        ],
      })
    }
  })

  it('sin nota y sin esfuerzo van como nulo', () => {
    const r = buildSessionPayload({ note: '   ', exercises: [exerciseDraft()] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload.note).toBeNull()
      expect(r.payload.exercises[0]!.effort).toBeNull()
      expect(r.payload.exercises[0]!.note).toBeNull()
    }
  })

  it('un ejercicio con cero series es válido', () => {
    const r = buildSessionPayload({
      note: '',
      exercises: [exerciseDraft({ sets: [emptySetInput()] })],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload.exercises[0]!.sets).toEqual([])
  })

  it('esfuerzo de 1 a 10', () => {
    for (const bad of ['0', '11', 'abc', '2,5']) {
      const r = buildSessionPayload({ note: '', exercises: [exerciseDraft({ effort: bad })] })
      expect(r.ok).toBe(false)
      if (!r.ok)
        expect(r.errors.exercises[0]!.effort).toBe(es.training.errors.session.invalid_effort)
    }
    expect(buildSessionPayload({ note: '', exercises: [exerciseDraft({ effort: '10' })] }).ok).toBe(
      true,
    )
  })

  it('notas: 1.000 para la sesión y 500 para el ejercicio', () => {
    const tooLongSession = buildSessionPayload({ note: 'a'.repeat(1001), exercises: [] })
    expect(tooLongSession.ok).toBe(false)
    if (!tooLongSession.ok)
      expect(tooLongSession.errors.note).toBe(es.training.errors.session.note_too_long)
    expect(buildSessionPayload({ note: 'a'.repeat(1000), exercises: [] }).ok).toBe(true)
    const tooLongExercise = buildSessionPayload({
      note: '',
      exercises: [exerciseDraft({ note: 'a'.repeat(501) })],
    })
    expect(tooLongExercise.ok).toBe(false)
    expect(
      buildSessionPayload({ note: '', exercises: [exerciseDraft({ note: 'a'.repeat(500) })] }).ok,
    ).toBe(true)
  })

  it('hasta 30 ejercicios y 20 series por ejercicio', () => {
    const many = Array.from({ length: 31 }, (_, i) => exerciseDraft({ id: `x${i}` }))
    const tooMany = buildSessionPayload({ note: '', exercises: many })
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok)
      expect(tooMany.errors.exercisesError).toBe(es.training.errors.session.too_many_exercises)
    expect(buildSessionPayload({ note: '', exercises: many.slice(0, 30) }).ok).toBe(true)

    const sets = Array.from({ length: 21 }, () => ({ ...emptySetInput(), reps: '5' }))
    const tooManySets = buildSessionPayload({ note: '', exercises: [exerciseDraft({ sets })] })
    expect(tooManySets.ok).toBe(false)
    expect(
      buildSessionPayload({ note: '', exercises: [exerciseDraft({ sets: sets.slice(0, 20) })] }).ok,
    ).toBe(true)
  })

  it('el error de un valor señala la serie y el campo', () => {
    const r = buildSessionPayload({
      note: '',
      exercises: [exerciseDraft({ sets: [{ ...emptySetInput(), reps: '1000' }] })],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.exercises[0]!.sets[0]).toEqual({ reps: v.reps })
  })

  it('un sustituto lleva el vínculo con su ítem del plan', () => {
    const r = buildSessionPayload({
      note: '',
      exercises: [exerciseDraft({ plan_item_id: 'p1', is_substitute: true })],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload.exercises[0]).toMatchObject({ plan_item_id: 'p1', is_substitute: true })
    }
  })
})
