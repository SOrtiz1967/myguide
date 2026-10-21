// T018 (spec 006, FR-033): estado del editor de sesión (reductor puro).
import { describe, expect, it } from 'vitest'
import {
  draftFromSession,
  editorReducer,
  emptyDraft,
  newExerciseDraft,
  sameDraft,
} from '../../src/features/training/sessionEditorState'
import { buildSessionPayload, emptySetInput } from '../../src/features/training/schema'
import type { SessionExercise } from '../../src/features/training/api'

const press = {
  id: 'x1',
  exercise_id: 'e1',
  exercise_name: 'Press',
  measurement_type: 'reps_weight' as const,
}
const plank = {
  id: 'x2',
  exercise_id: 'e2',
  exercise_name: 'Plancha',
  measurement_type: 'duration' as const,
}

function two() {
  let state = emptyDraft()
  state = editorReducer(state, { type: 'addExercise', exercise: press })
  state = editorReducer(state, { type: 'addExercise', exercise: plank })
  return state
}

describe('ejercicios', () => {
  it('agregar un ejercicio lo suma al final con una serie vacía lista para escribir', () => {
    const state = two()
    expect(state.exercises.map((e) => e.id)).toEqual(['x1', 'x2'])
    expect(state.exercises[0]!.sets).toEqual([emptySetInput()])
    expect(state.exercises[0]).toMatchObject({
      exercise_id: 'e1',
      exercise_name: 'Press',
      plan_item_id: null,
      is_substitute: false,
      effort: '',
      note: '',
    })
  })

  it('no se agrega más de una vez el mismo id ni más de 30 ejercicios', () => {
    let state = two()
    state = editorReducer(state, { type: 'addExercise', exercise: press })
    expect(state.exercises).toHaveLength(2)
    let full = emptyDraft()
    for (let i = 0; i < 30; i++) {
      full = editorReducer(full, { type: 'addExercise', exercise: { ...press, id: `x${i}` } })
    }
    expect(full.exercises).toHaveLength(30)
    expect(
      editorReducer(full, { type: 'addExercise', exercise: { ...press, id: 'otro' } }).exercises,
    ).toHaveLength(30)
  })

  it('quitar y reordenar', () => {
    let state = two()
    state = editorReducer(state, { type: 'moveExercise', id: 'x2', direction: 'up' })
    expect(state.exercises.map((e) => e.id)).toEqual(['x2', 'x1'])
    state = editorReducer(state, { type: 'moveExercise', id: 'x2', direction: 'up' })
    expect(state.exercises.map((e) => e.id)).toEqual(['x2', 'x1'])
    state = editorReducer(state, { type: 'moveExercise', id: 'x1', direction: 'down' })
    expect(state.exercises.map((e) => e.id)).toEqual(['x2', 'x1'])
    state = editorReducer(state, { type: 'removeExercise', id: 'x2' })
    expect(state.exercises.map((e) => e.id)).toEqual(['x1'])
  })

  it('esfuerzo y notas', () => {
    let state = two()
    state = editorReducer(state, { type: 'setEffort', exerciseId: 'x1', value: '7' })
    state = editorReducer(state, { type: 'setExerciseNote', exerciseId: 'x1', value: 'pesado' })
    state = editorReducer(state, { type: 'setNote', value: 'buena sesión' })
    expect(state.exercises[0]).toMatchObject({ effort: '7', note: 'pesado' })
    expect(state.note).toBe('buena sesión')
    expect(state.exercises[1]).toMatchObject({ effort: '', note: '' })
  })
})

describe('series', () => {
  it('agregar, editar, quitar y reordenar', () => {
    let state = two()
    state = editorReducer(state, {
      type: 'editSet',
      exerciseId: 'x1',
      index: 0,
      field: 'reps',
      value: '8',
    })
    state = editorReducer(state, {
      type: 'editSet',
      exerciseId: 'x1',
      index: 0,
      field: 'weight_kg',
      value: '60',
    })
    state = editorReducer(state, { type: 'addSet', exerciseId: 'x1' })
    state = editorReducer(state, {
      type: 'editSet',
      exerciseId: 'x1',
      index: 1,
      field: 'reps',
      value: '6',
    })
    expect(state.exercises[0]!.sets.map((s) => s.reps)).toEqual(['8', '6'])
    state = editorReducer(state, { type: 'moveSet', exerciseId: 'x1', index: 1, direction: 'up' })
    expect(state.exercises[0]!.sets.map((s) => s.reps)).toEqual(['6', '8'])
    state = editorReducer(state, { type: 'removeSet', exerciseId: 'x1', index: 0 })
    expect(state.exercises[0]!.sets.map((s) => s.reps)).toEqual(['8'])
    state = editorReducer(state, { type: 'removeSet', exerciseId: 'x1', index: 0 })
    expect(state.exercises[0]!.sets).toEqual([])
  })

  it('copiar la serie anterior', () => {
    let state = two()
    state = editorReducer(state, {
      type: 'editSet',
      exerciseId: 'x1',
      index: 0,
      field: 'reps',
      value: '8',
    })
    state = editorReducer(state, {
      type: 'editSet',
      exerciseId: 'x1',
      index: 0,
      field: 'weight_kg',
      value: '62,5',
    })
    state = editorReducer(state, { type: 'copyPreviousSet', exerciseId: 'x1' })
    expect(state.exercises[0]!.sets).toEqual([
      { ...emptySetInput(), reps: '8', weight_kg: '62,5' },
      { ...emptySetInput(), reps: '8', weight_kg: '62,5' },
    ])
    // sin series previas, agrega una vacía
    let none = editorReducer(two(), { type: 'removeSet', exerciseId: 'x1', index: 0 })
    none = editorReducer(none, { type: 'copyPreviousSet', exerciseId: 'x1' })
    expect(none.exercises[0]!.sets).toEqual([emptySetInput()])
  })

  it('no más de 20 series por ejercicio', () => {
    let state = two()
    for (let i = 0; i < 25; i++) state = editorReducer(state, { type: 'addSet', exerciseId: 'x1' })
    expect(state.exercises[0]!.sets).toHaveLength(20)
    expect(
      editorReducer(state, { type: 'copyPreviousSet', exerciseId: 'x1' }).exercises[0]!.sets,
    ).toHaveLength(20)
  })

  it('editar no muta el estado anterior', () => {
    const before = two()
    const copy = JSON.stringify(before)
    editorReducer(before, {
      type: 'editSet',
      exerciseId: 'x1',
      index: 0,
      field: 'reps',
      value: '9',
    })
    expect(JSON.stringify(before)).toBe(copy)
  })

  it('acciones sobre un ejercicio inexistente no cambian nada', () => {
    const state = two()
    expect(editorReducer(state, { type: 'addSet', exerciseId: 'nada' })).toEqual(state)
    expect(editorReducer(state, { type: 'removeExercise', id: 'nada' })).toEqual(state)
  })
})

describe('draftFromSession: del servidor al formulario', () => {
  const server: SessionExercise[] = [
    {
      id: 'b',
      position: 2,
      exercise_id: null,
      exercise_name: 'Correr',
      measurement_type: 'distance_duration',
      plan_item_id: null,
      is_substitute: false,
      effort: null,
      note: null,
      session_sets: [
        { id: 's1', position: 1, reps: null, weight_kg: null, duration_s: 3930, distance_km: 5.25 },
      ],
    },
    {
      id: 'a',
      position: 1,
      exercise_id: 'e1',
      exercise_name: 'Press',
      measurement_type: 'reps_weight',
      plan_item_id: 'p1',
      is_substitute: true,
      effort: 7,
      note: 'pesado',
      session_sets: [
        { id: 's3', position: 2, reps: 6, weight_kg: null, duration_s: null, distance_km: null },
        { id: 's2', position: 1, reps: 8, weight_kg: 62.5, duration_s: null, distance_km: null },
      ],
    },
  ]

  it('ordena por posición y escribe los números como los escribiría la persona', () => {
    const draft = draftFromSession({ note: 'Fin', session_exercises: server })
    expect(draft.note).toBe('Fin')
    expect(draft.exercises.map((e) => e.id)).toEqual(['a', 'b'])
    expect(draft.exercises[0]).toMatchObject({
      effort: '7',
      note: 'pesado',
      plan_item_id: 'p1',
      is_substitute: true,
      exercise_id: 'e1',
    })
    expect(draft.exercises[0]!.sets).toEqual([
      { ...emptySetInput(), reps: '8', weight_kg: '62,5' },
      { ...emptySetInput(), reps: '6' },
    ])
    expect(draft.exercises[1]!.sets).toEqual([
      { ...emptySetInput(), duration: '1:05:30', distance_km: '5,25' },
    ])
    expect(draft.exercises[1]).toMatchObject({ effort: '', note: '', exercise_id: null })
  })

  it('ida y vuelta: el payload armado coincide con lo guardado', () => {
    const r = buildSessionPayload(draftFromSession({ note: null, session_exercises: server }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload.note).toBeNull()
      expect(r.payload.exercises[0]).toMatchObject({
        id: 'a',
        effort: 7,
        sets: [{ reps: 8, weight_kg: 62.5 }, { reps: 6 }],
      })
      expect(r.payload.exercises[1]!.sets).toEqual([{ duration_s: 3930, distance_km: 5.25 }])
    }
  })

  it('un ejercicio ya guardado conserva su instantánea en el borrador', () => {
    const draft = draftFromSession({ note: null, session_exercises: server })
    expect(draft.exercises[1]).toMatchObject({
      exercise_name: 'Correr',
      measurement_type: 'distance_duration',
    })
  })
})

describe('cambios sin guardar', () => {
  it('compara dos borradores por contenido', () => {
    const a = two()
    expect(sameDraft(a, two())).toBe(true)
    expect(
      sameDraft(
        a,
        editorReducer(a, {
          type: 'editSet',
          exerciseId: 'x1',
          index: 0,
          field: 'reps',
          value: '1',
        }),
      ),
    ).toBe(false)
  })

  it('newExerciseDraft arma un ejercicio con una serie vacía', () => {
    const e = newExerciseDraft({ ...press, plan_item_id: 'p1', is_substitute: true })
    expect(e).toMatchObject({ plan_item_id: 'p1', is_substitute: true })
    expect(e.sets).toEqual([emptySetInput()])
  })
})
