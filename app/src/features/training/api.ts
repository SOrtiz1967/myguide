import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { WriteError } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import type { MeasurementType } from '../exercises/exerciseLists'
import type { SessionPayload } from './schema'
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

// --- Errores con significado propio --------------------------------------------------------------------------------

/** Otro dispositivo guardó la sesión antes (`stale_revision`): hay que elegir qué versión conservar. */
export class StaleRevisionError extends Error {
  constructor() {
    super('stale_revision')
    this.name = 'StaleRevisionError'
  }
}

/** Ya hay una sesión en curso; lleva su identificador para ofrecer continuarla (FR-009). */
export class SessionInProgressError extends Error {
  readonly sessionId: string | null
  constructor(sessionId: string | null) {
    super(es.training.errors.sessionInProgress)
    this.name = 'SessionInProgressError'
    this.sessionId = sessionId
  }
}

/**
 * Llama a una función del servidor. Sin conexión no lo intenta; un fallo se convierte en un error con un mensaje
 * seguro (`WriteError`), salvo los dos que tienen significado propio. Nunca se muestra el texto crudo del servidor.
 */
async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new WriteError(true, es.errors.offline)
  }
  let result
  try {
    result = await supabase.rpc(name, args)
  } catch (error) {
    throw translateError(error)
  }
  if (result.error) throw translateError(result.error)
  return result.data as T
}

function translateError(error: unknown): Error {
  if (isNetworkError(error)) return new WriteError(true, es.errors.offline)
  const message = (error as { message?: unknown } | null)?.message
  if (typeof message === 'string' && message.startsWith('stale_revision'))
    return new StaleRevisionError()
  const open = openSessionIdFromError(error)
  if (open || (typeof message === 'string' && message.startsWith('session_in_progress'))) {
    return new SessionInProgressError(open)
  }
  return new WriteError(false, trainingErrorMessage(error) ?? es.errors.generic)
}

// --- Sesiones ----------------------------------------------------------------------------------------------------------

export interface StartResult {
  id: string
  session_date: string
  status: SessionStatus
  revision: number
}

export interface SaveResult {
  revision: number
  status: SessionStatus
  modified: boolean
  corrected_at: string | null
  finished_at: string | null
}

const SUMMARY_COLUMNS =
  'id, session_date, original_date, status, routine_name, has_plan, modified, rescheduled_count, corrected_at'

const SESSION_COLUMNS = `${SUMMARY_COLUMNS}, routine_id, note, started_at, finished_at, revision,
  session_plan_items(*), session_exercises(*, session_sets(*)), session_date_changes(*)`

// Un id con formato inválido (22P02) se comporta como una sesión inexistente.
const INVALID_TEXT_REPRESENTATION = '22P02'

/** Inicia una sesión vacía en curso (hoy, o una fecha pasada). Idempotente por `requestId`. */
export function startWorkout(sessionDate: string | null, requestId: string): Promise<StartResult> {
  return callRpc<StartResult>('start_workout', {
    session_date: sessionDate,
    request_id: requestId,
    client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

/** Guarda el contenido de la sesión (reemplazo completo con revisión). Puede lanzar `StaleRevisionError`. */
export function saveWorkout(
  sessionId: string,
  payload: SessionPayload,
  expectedRevision: number,
  finish: boolean,
): Promise<SaveResult> {
  return callRpc<SaveResult>('save_workout', {
    id: sessionId,
    payload,
    expected_revision: expectedRevision,
    finish,
  })
}

/** La sesión con su plan, sus ejercicios, sus series y su recorrido de fechas; `null` si no existe o es ajena. */
export async function fetchSession(id: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return null
    throw error
  }
  return (data as unknown as WorkoutSession | null) ?? null
}

/** La sesión en curso de la cuenta, si la hay. */
export async function fetchInProgressSession(): Promise<SessionSummary | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (error) throw error
  return (data as unknown as SessionSummary | null) ?? null
}

/** Las últimas sesiones realizadas, de la más reciente a la más antigua. */
export async function fetchRecentSessions(limit = 10): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'completed')
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as SessionSummary[]
}

/** Elimina una sesión propia con todo lo suyo (borrado directo por RLS). */
export async function deleteSession(id: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new WriteError(true, es.errors.offline)
  }
  const { data, error } = await supabase.from('workout_sessions').delete().eq('id', id).select('id')
  if (error) throw translateError(error)
  if (!data || data.length === 0) throw new WriteError(false, es.training.errors.notFound)
}
