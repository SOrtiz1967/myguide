import type { MeasurementType } from '../exercises/exerciseLists'
import type { SessionExercise, SessionSet } from './api'
import { MAX_EXERCISES, MAX_SETS } from './limits'
import {
  emptySetInput,
  type SessionDraft,
  type SessionExerciseDraft,
  type SetInput,
} from './schema'

// Estado del editor de sesión (spec 006, FR-033): un reductor puro, sin interfaz, para probarlo a fondo. Es el
// mismo borrador que se guarda en el dispositivo y el que se convierte en el payload de `save_workout`.

export const emptyDraft = (): SessionDraft => ({ note: '', exercises: [] })

export interface NewExercise {
  /** Lo genera el cliente (también da idempotencia al reintentar). */
  id: string
  exercise_id: string | null
  exercise_name: string
  measurement_type: MeasurementType
  plan_item_id?: string | null
  is_substitute?: boolean
}

export function newExerciseDraft(exercise: NewExercise): SessionExerciseDraft {
  return {
    id: exercise.id,
    exercise_id: exercise.exercise_id,
    exercise_name: exercise.exercise_name,
    measurement_type: exercise.measurement_type,
    plan_item_id: exercise.plan_item_id ?? null,
    is_substitute: exercise.is_substitute ?? false,
    effort: '',
    note: '',
    sets: [emptySetInput()],
  }
}

export type EditorAction =
  | { type: 'addExercise'; exercise: NewExercise }
  | { type: 'removeExercise'; id: string }
  | { type: 'moveExercise'; id: string; direction: 'up' | 'down' }
  | { type: 'addSet'; exerciseId: string }
  | { type: 'copyPreviousSet'; exerciseId: string }
  | { type: 'removeSet'; exerciseId: string; index: number }
  | { type: 'moveSet'; exerciseId: string; index: number; direction: 'up' | 'down' }
  | { type: 'editSet'; exerciseId: string; index: number; field: keyof SetInput; value: string }
  | { type: 'setEffort'; exerciseId: string; value: string }
  | { type: 'setExerciseNote'; exerciseId: string; value: string }
  | { type: 'setNote'; value: string }
  | { type: 'replace'; draft: SessionDraft }

function move<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  return next
}

/** Aplica un cambio a un ejercicio; si no existe, devuelve el mismo estado. */
function updateExercise(
  state: SessionDraft,
  id: string,
  change: (exercise: SessionExerciseDraft) => SessionExerciseDraft,
): SessionDraft {
  const index = state.exercises.findIndex((e) => e.id === id)
  if (index === -1) return state
  const exercises = [...state.exercises]
  exercises[index] = change(exercises[index]!)
  return { ...state, exercises }
}

export function editorReducer(state: SessionDraft, action: EditorAction): SessionDraft {
  switch (action.type) {
    case 'addExercise': {
      if (state.exercises.length >= MAX_EXERCISES) return state
      if (state.exercises.some((e) => e.id === action.exercise.id)) return state
      return { ...state, exercises: [...state.exercises, newExerciseDraft(action.exercise)] }
    }
    case 'removeExercise':
      return state.exercises.some((e) => e.id === action.id)
        ? { ...state, exercises: state.exercises.filter((e) => e.id !== action.id) }
        : state
    case 'moveExercise': {
      const index = state.exercises.findIndex((e) => e.id === action.id)
      const exercises = move(state.exercises, index, action.direction)
      return exercises === state.exercises ? state : { ...state, exercises }
    }
    case 'addSet':
      return updateExercise(state, action.exerciseId, (e) =>
        e.sets.length >= MAX_SETS ? e : { ...e, sets: [...e.sets, emptySetInput()] },
      )
    case 'copyPreviousSet':
      return updateExercise(state, action.exerciseId, (e) => {
        if (e.sets.length >= MAX_SETS) return e
        const last = e.sets[e.sets.length - 1]
        return { ...e, sets: [...e.sets, last ? { ...last } : emptySetInput()] }
      })
    case 'removeSet':
      return updateExercise(state, action.exerciseId, (e) => ({
        ...e,
        sets: e.sets.filter((_, i) => i !== action.index),
      }))
    case 'moveSet':
      return updateExercise(state, action.exerciseId, (e) => ({
        ...e,
        sets: move(e.sets, action.index, action.direction),
      }))
    case 'editSet':
      return updateExercise(state, action.exerciseId, (e) => ({
        ...e,
        sets: e.sets.map((set, i) =>
          i === action.index ? { ...set, [action.field]: action.value } : set,
        ),
      }))
    case 'setEffort':
      return updateExercise(state, action.exerciseId, (e) => ({ ...e, effort: action.value }))
    case 'setExerciseNote':
      return updateExercise(state, action.exerciseId, (e) => ({ ...e, note: action.value }))
    case 'setNote':
      return { ...state, note: action.value }
    case 'replace':
      return action.draft
  }
}

// --- Del servidor al formulario -------------------------------------------------------------------------------------

/** 62.5 → '62,5': como lo escribiría la persona. */
const numberInput = (value: number | null): string =>
  value === null ? '' : String(value).replace('.', ',')

/** 90 → '1:30'; 3930 → '1:05:30' (los formatos que acepta `parseDuration`). */
export function durationInput(totalSeconds: number | null): string {
  if (totalSeconds === null) return ''
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export function setInputFromValues(
  set: Pick<SessionSet, 'reps' | 'weight_kg' | 'duration_s' | 'distance_km'>,
): SetInput {
  return {
    reps: numberInput(set.reps),
    weight_kg: numberInput(set.weight_kg),
    duration: durationInput(set.duration_s),
    distance_km: numberInput(set.distance_km),
  }
}

/** El borrador del editor a partir de una sesión guardada. Conserva la instantánea de cada ejercicio. */
export function draftFromSession(session: {
  note: string | null
  session_exercises: SessionExercise[]
}): SessionDraft {
  return {
    note: session.note ?? '',
    exercises: [...session.session_exercises]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise_name,
        measurement_type: exercise.measurement_type,
        plan_item_id: exercise.plan_item_id,
        is_substitute: exercise.is_substitute,
        effort: exercise.effort === null ? '' : String(exercise.effort),
        note: exercise.note ?? '',
        sets: [...exercise.session_sets]
          .sort((a, b) => a.position - b.position)
          .map(setInputFromValues),
      })),
  }
}

/** ¿Dos borradores tienen el mismo contenido? */
export const sameDraft = (a: SessionDraft, b: SessionDraft): boolean =>
  JSON.stringify(a) === JSON.stringify(b)
