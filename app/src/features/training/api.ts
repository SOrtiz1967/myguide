import { es } from '../../copy/es'
import type { MeasurementType } from '../exercises/exerciseLists'
import type { SessionStatus } from './trainingText'

// Acceso a datos de rutinas y sesiones (spec 006). Las escrituras pasan por funciones del servidor
// (contracts/database-api.md); aquí viven los tipos y la traducción de errores.

export interface ExerciseRef {
  id: string
  name: string
  measurement_type: MeasurementType
}

export interface TargetFields {
  target_reps: number | null
  target_weight_kg: number | null
  target_duration_s: number | null
  target_distance_km: number | null
}

export interface RoutineExercise extends TargetFields {
  id: string
  routine_id: string
  position: number
  exercise_id: string | null
  exercise_name: string
  measurement_type: MeasurementType
  sets: number
  /** El ejercicio vigente (nulo si ya no existe o no es visible). */
  exercise: ExerciseRef | null
}

export interface Routine {
  id: string
  name: string
  created_at: string
  updated_at: string
  routine_exercises: RoutineExercise[]
}

export interface PlanItem extends TargetFields {
  id: string
  session_id: string
  position: number
  exercise_id: string | null
  exercise_name: string
  measurement_type: MeasurementType
  sets: number
  targets_dropped: boolean
}

export interface SessionSet {
  id: string
  position: number
  reps: number | null
  weight_kg: number | null
  duration_s: number | null
  distance_km: number | null
}

export interface SessionExercise {
  id: string
  position: number
  exercise_id: string | null
  exercise_name: string
  measurement_type: MeasurementType
  plan_item_id: string | null
  is_substitute: boolean
  effort: number | null
  note: string | null
  session_sets: SessionSet[]
}

export interface DateChange {
  id: string
  from_date: string
  to_date: string
  created_at: string
}

export interface SessionSummary {
  id: string
  session_date: string
  original_date: string
  status: SessionStatus
  routine_name: string | null
  has_plan: boolean
  modified: boolean
  rescheduled_count: number
  corrected_at: string | null
}

export interface WorkoutSession extends SessionSummary {
  routine_id: string | null
  note: string | null
  started_at: string | null
  finished_at: string | null
  revision: number
  session_plan_items: PlanItem[]
  session_exercises: SessionExercise[]
  session_date_changes: DateChange[]
}

export interface HistoryEntry {
  session_id: string
  session_date: string
  exercise_name: string
  effort: number | null
  note: string | null
  sets: Array<{ reps?: number; weight_kg?: number; duration_s?: number; distance_km?: number }>
  total_estimate: number
}

const e = es.training.errors

/** El identificador de la sesión abierta, si el error es `session_in_progress:<id>`. */
export function openSessionIdFromError(error: unknown): string | null {
  const message = (error as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null
  return /^session_in_progress:([0-9a-f-]{36})/i.exec(message)?.[1] ?? null
}

/**
 * Traduce un error conocido del servidor (`stale_revision`, `invalid_session:<motivo>:<campo>`...) a un mensaje
 * claro. Devuelve `null` si no lo reconoce: quien llama usa entonces el mensaje general. Nunca se muestra el
 * texto crudo del servidor (FR-053).
 */
export function trainingErrorMessage(error: unknown): string | null {
  const message = (error as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null
  if (message.startsWith('session_expired')) return es.auth.sessionExpired
  if (message.startsWith('session_in_progress')) return e.sessionInProgress
  if (message.startsWith('stale_revision')) return e.staleRevision
  if (message.startsWith('invalid_transition')) return e.invalidTransition
  if (message.startsWith('invalid_date')) return e.invalidDate
  if (message.startsWith('not_found')) return e.notFound
  const match = /^invalid_(routine|session):([a-z_]+):/.exec(message)
  if (match) {
    const table = match[1] === 'routine' ? e.routine : e.session
    return table[match[2]!] ?? e.saveFailed
  }
  return null
}
