import { z } from 'zod'
import { es } from '../../copy/es'
import { isMeasurementType, type MeasurementType } from '../exercises/exerciseLists'
import {
  MAX_DISTANCE_KM,
  MAX_DURATION_S,
  MAX_EFFORT,
  MAX_EXERCISES,
  MAX_EXERCISE_NOTE,
  MAX_REPS,
  MAX_ROUTINE_NAME,
  MAX_SESSION_NOTE,
  MAX_SETS,
  MAX_WEIGHT_KG,
  MIN_EFFORT,
} from './limits'
import {
  parseDecimal,
  parseDuration,
  setFields,
  type SetField,
  type SetValues,
} from './trainingText'

// Las mismas reglas que las funciones de la base (spec 006, FR-002, FR-028, FR-031, FR-032) para que la
// persona vea el error al escribir y no recién al guardar. La base las vuelve a imponer.

const v = es.training.validation
const re = es.training.errors.routine
const se = es.training.errors.session

// ---------------------------------------------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------------------------------------------

/** Lo que se escribe en una serie: todo texto, porque la persona escribe con coma decimal o con «mm:ss». */
export interface SetInput {
  reps: string
  weight_kg: string
  /** «mm:ss», «h:mm:ss» o segundos. */
  duration: string
  distance_km: string
}

export const emptySetInput = (): SetInput => ({
  reps: '',
  weight_kg: '',
  duration: '',
  distance_km: '',
})

export interface ParsedSet {
  values: {
    reps: number | null
    weight_kg: number | null
    duration_s: number | null
    distance_km: number | null
  }
  errors: Partial<Record<SetField, string>>
  /** Ningún valor del tipo de medición está escrito: la serie no se guarda y no es un error. */
  empty: boolean
}

/** Lee una serie según el tipo de medición; solo se leen los campos que ese tipo admite. */
export function parseSet(type: MeasurementType, input: SetInput): ParsedSet {
  const values: ParsedSet['values'] = {
    reps: null,
    weight_kg: null,
    duration_s: null,
    distance_km: null,
  }
  const errors: ParsedSet['errors'] = {}

  for (const field of setFields(type)) {
    if (field === 'reps') {
      const n = parseDecimal(input.reps)
      if (n === null) continue
      if (Number.isNaN(n)) errors.reps = v.number
      else if (!Number.isInteger(n) || n < 1 || n > MAX_REPS) errors.reps = v.reps
      else values.reps = n
    } else if (field === 'weight_kg') {
      const n = parseDecimal(input.weight_kg)
      if (n === null) continue
      if (Number.isNaN(n)) errors.weight_kg = v.number
      else if (n < 0 || n > MAX_WEIGHT_KG) errors.weight_kg = v.weight
      else values.weight_kg = n
    } else if (field === 'duration_s') {
      const n = parseDuration(input.duration)
      if (n === null) continue
      if (Number.isNaN(n) || n < 1 || n > MAX_DURATION_S) errors.duration_s = v.duration
      else values.duration_s = n
    } else {
      const n = parseDecimal(input.distance_km)
      if (n === null) continue
      if (Number.isNaN(n)) errors.distance_km = v.number
      else if (n <= 0 || n > MAX_DISTANCE_KM) errors.distance_km = v.distance
      else values.distance_km = n
    }
  }

  const empty =
    Object.keys(errors).length === 0 && setFields(type).every((field) => values[field] === null)
  return { values, errors, empty }
}

// ---------------------------------------------------------------------------------------------------------------
// Rutinas
// ---------------------------------------------------------------------------------------------------------------

const routineItemSchema = z.object({
  exercise_id: z.string(),
  exercise_name: z.string(),
  measurement_type: z.string(),
  sets: z.string(),
  target_reps: z.string(),
  target_weight_kg: z.string(),
  /** «mm:ss», «h:mm:ss» o segundos. */
  target_duration: z.string(),
  target_distance_km: z.string(),
})

/** Los campos de objetivo que admite cada tipo de medición (los mismos que una serie). */
const TARGET_INPUTS: Record<MeasurementType, Array<keyof z.infer<typeof routineItemSchema>>> = {
  reps_weight: ['target_reps', 'target_weight_kg'],
  reps_bodyweight: ['target_reps'],
  duration: ['target_duration'],
  distance_duration: ['target_distance_km', 'target_duration'],
}

export interface RoutinePayloadItem {
  exercise_id: string
  sets: number
  target_reps: number | null
  target_weight_kg: number | null
  target_duration_s: number | null
  target_distance_km: number | null
}

/** Lo que recibe `create_routine` / `update_routine`. */
export interface RoutinePayload {
  name: string
  exercises: RoutinePayloadItem[]
}

export const routineFormSchema = z
  .object({ name: z.string(), exercises: z.array(routineItemSchema) })
  .superRefine((values, ctx) => {
    const issue = (path: Array<string | number>, message: string) =>
      ctx.addIssue({ code: 'custom', path, message })

    const name = values.name.trim()
    if (name === '') issue(['name'], re.name_required)
    else if (name.length > MAX_ROUTINE_NAME) issue(['name'], re.name_too_long)

    if (values.exercises.length === 0) issue(['exercises'], re.exercises_required)
    else if (values.exercises.length > MAX_EXERCISES) issue(['exercises'], re.too_many_exercises)

    values.exercises.forEach((item, index) => {
      const at = (field: string) => ['exercises', index, field]
      if (
        !/^\d+$/.test(item.sets.trim()) ||
        Number(item.sets) < 1 ||
        Number(item.sets) > MAX_SETS
      ) {
        issue(at('sets'), re.invalid_sets)
      }
      if (!isMeasurementType(item.measurement_type)) {
        issue(at('measurement_type'), es.training.errors.saveFailed)
        return
      }
      const allowed = TARGET_INPUTS[item.measurement_type]
      for (const field of [
        'target_reps',
        'target_weight_kg',
        'target_duration',
        'target_distance_km',
      ] as const) {
        const text = item[field].trim()
        if (text === '') continue
        if (!allowed.includes(field)) {
          issue(at(field), re.invalid_target)
          continue
        }
        if (field === 'target_reps') {
          const n = parseDecimal(text)
          if (Number.isNaN(n)) issue(at(field), v.number)
          else if (n === null || !Number.isInteger(n) || n < 1 || n > MAX_REPS)
            issue(at(field), v.reps)
        } else if (field === 'target_weight_kg') {
          const n = parseDecimal(text)
          if (Number.isNaN(n)) issue(at(field), v.number)
          else if (n === null || n < 0 || n > MAX_WEIGHT_KG) issue(at(field), v.weight)
        } else if (field === 'target_duration') {
          const n = parseDuration(text)
          if (n === null || Number.isNaN(n) || n < 1 || n > MAX_DURATION_S)
            issue(at(field), v.duration)
        } else {
          const n = parseDecimal(text)
          if (Number.isNaN(n)) issue(at(field), v.number)
          else if (n === null || n <= 0 || n > MAX_DISTANCE_KM) issue(at(field), v.distance)
        }
      }
    })
  })
  .transform((values): RoutinePayload => ({
    name: values.name.trim(),
    exercises: values.exercises.map((item) => ({
      exercise_id: item.exercise_id,
      sets: Number(item.sets),
      target_reps: parseDecimal(item.target_reps),
      target_weight_kg: parseDecimal(item.target_weight_kg),
      target_duration_s: parseDuration(item.target_duration),
      target_distance_km: parseDecimal(item.target_distance_km),
    })),
  }))

export type RoutineFormInput = z.input<typeof routineFormSchema>

export const emptyRoutineForm = (): RoutineFormInput => ({ name: '', exercises: [] })

// ---------------------------------------------------------------------------------------------------------------
// Sesiones
// ---------------------------------------------------------------------------------------------------------------

/** Un ejercicio realizado en el editor: lo que se escribe, antes de convertirlo al payload del servidor. */
export interface SessionExerciseDraft {
  /** Lo genera el cliente: también da idempotencia al reintentar. */
  id: string
  exercise_id: string | null
  exercise_name: string
  measurement_type: MeasurementType
  plan_item_id: string | null
  is_substitute: boolean
  /** '' (sin dato) o un entero de 1 a 10. */
  effort: string
  note: string
  sets: SetInput[]
}

export interface SessionDraft {
  note: string
  exercises: SessionExerciseDraft[]
}

/** Una serie del payload: solo los valores presentes. */
export type PayloadSet = Partial<Record<Exclude<SetField, never>, number>>

export interface SessionPayloadExercise {
  id: string
  exercise_id: string | null
  plan_item_id: string | null
  is_substitute: boolean
  effort: number | null
  note: string | null
  sets: PayloadSet[]
}

/** Lo que recibe `save_session`. */
export interface SessionPayload {
  note: string | null
  exercises: SessionPayloadExercise[]
}

export interface SessionExerciseErrors {
  effort?: string
  note?: string
  setsError?: string
  /** Un arreglo alineado con las series escritas (vacío = sin error en esa serie). */
  sets: Array<Partial<Record<SetField, string>>>
}

export interface SessionErrors {
  note?: string
  exercisesError?: string
  exercises: SessionExerciseErrors[]
}

export type BuildResult =
  { ok: true; payload: SessionPayload } | { ok: false; errors: SessionErrors }

const textOrNull = (text: string): string | null => {
  const clean = text.trim()
  return clean === '' ? null : clean
}

/**
 * Convierte el borrador del editor en el payload de `save_session`: descarta las series vacías, solo manda los
 * valores presentes y valida con los mismos límites que la base.
 */
export function buildSessionPayload(draft: SessionDraft): BuildResult {
  const errors: SessionErrors = { exercises: [] }
  let failed = false

  const note = textOrNull(draft.note)
  if (note && note.length > MAX_SESSION_NOTE) {
    errors.note = se.note_too_long
    failed = true
  }
  if (draft.exercises.length > MAX_EXERCISES) {
    errors.exercisesError = se.too_many_exercises
    failed = true
  }

  const exercises: SessionPayloadExercise[] = draft.exercises.map((exercise) => {
    const exerciseErrors: SessionExerciseErrors = { sets: [] }

    let effort: number | null = null
    const effortText = exercise.effort.trim()
    if (effortText !== '') {
      const n = /^\d+$/.test(effortText) ? Number(effortText) : Number.NaN
      if (Number.isNaN(n) || n < MIN_EFFORT || n > MAX_EFFORT) {
        exerciseErrors.effort = se.invalid_effort
        failed = true
      } else effort = n
    }

    const exerciseNote = textOrNull(exercise.note)
    if (exerciseNote && exerciseNote.length > MAX_EXERCISE_NOTE) {
      exerciseErrors.note = se.note_too_long
      failed = true
    }

    const sets: PayloadSet[] = []
    for (const input of exercise.sets) {
      const parsed = parseSet(exercise.measurement_type, input)
      exerciseErrors.sets.push(parsed.errors)
      if (Object.keys(parsed.errors).length > 0) {
        failed = true
        continue
      }
      if (parsed.empty) continue
      const set: PayloadSet = {}
      for (const field of setFields(exercise.measurement_type)) {
        const value = parsed.values[field as keyof ParsedSet['values']]
        if (value !== null) set[field] = value
      }
      sets.push(set)
    }
    if (sets.length > MAX_SETS) {
      exerciseErrors.setsError = se.too_many_sets
      failed = true
    }
    errors.exercises.push(exerciseErrors)

    return {
      id: exercise.id,
      exercise_id: exercise.exercise_id,
      plan_item_id: exercise.plan_item_id,
      is_substitute: exercise.is_substitute,
      effort,
      note: exerciseNote,
      sets,
    }
  })

  return failed ? { ok: false, errors } : { ok: true, payload: { note, exercises } }
}

export type { SetValues }
