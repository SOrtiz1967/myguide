import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { WriteError } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import type { MeasurementType } from '../exercises/exerciseLists'
import type { RoutinePayload, SessionPayload } from './schema'
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
  measurement_type: MeasurementType
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
    const table: Record<string, string | undefined> = match[1] === 'routine' ? e.routine : e.session
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

/** Inicia una sesión en curso con el plan de una rutina. Idempotente por `requestId`. */
export function startWorkoutFromRoutine(
  routineId: string,
  sessionDate: string | null,
  requestId: string,
): Promise<StartResult> {
  return callRpc<StartResult>('start_workout_from_routine', {
    routine_id: routineId,
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

// --- Rutinas -----------------------------------------------------------------------------------------------------------

const ROUTINE_COLUMNS =
  'id, name, created_at, updated_at, routine_exercises(*, exercise:exercises(id, name, measurement_type))'

function sortRoutine(routine: Routine): Routine {
  return {
    ...routine,
    routine_exercises: [...routine.routine_exercises].sort((a, b) => a.position - b.position),
  }
}

/** Crea una rutina, de forma atómica e idempotente por `requestId`. Devuelve su identificador. */
export function createRoutine(payload: RoutinePayload, requestId: string): Promise<string> {
  return callRpc<string>('create_routine', { routine: payload, request_id: requestId })
}

/** Reemplaza el nombre y los ejercicios de una rutina propia. No toca ninguna sesión. */
export function updateRoutine(id: string, payload: RoutinePayload): Promise<string> {
  return callRpc<string>('update_routine', { id, routine: payload })
}

/** Crea una copia independiente de una rutina propia. */
export function duplicateRoutine(id: string, requestId: string): Promise<string> {
  return callRpc<string>('duplicate_routine', { id, request_id: requestId })
}

/** Elimina una rutina propia; las sesiones creadas con ella conservan su plan (borrado directo por RLS). */
export async function deleteRoutine(id: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new WriteError(true, es.errors.offline)
  }
  const { data, error } = await supabase.from('routines').delete().eq('id', id).select('id')
  if (error) throw translateError(error)
  if (!data || data.length === 0) throw new WriteError(false, es.training.errors.notFound)
}

/** Las rutinas de la cuenta, por nombre, con sus ejercicios y el ejercicio vigente de cada ítem. */
export async function fetchRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase.from('routines').select(ROUTINE_COLUMNS).order('name')
  if (error) throw error
  return ((data ?? []) as unknown as Routine[]).map(sortRoutine)
}

/** Una rutina, o `null` si no existe o es ajena. */
export async function fetchRoutine(id: string): Promise<Routine | null> {
  const { data, error } = await supabase
    .from('routines')
    .select(ROUTINE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return null
    throw error
  }
  return data ? sortRoutine(data as unknown as Routine) : null
}

// --- Planificación y calendario ----------------------------------------------------------------------------------------

export interface MoveResult {
  id: string
  session_date: string
  status: SessionStatus
  rescheduled_count: number
}

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** Planifica una sesión para hoy o un día futuro, con una rutina o vacía. Idempotente por `requestId`. */
export function planWorkout(
  sessionDate: string,
  routineId: string | null,
  requestId: string,
): Promise<string> {
  return callRpc<string>('plan_workout', {
    session_date: sessionDate,
    routine_id: routineId,
    request_id: requestId,
    client_timezone: timezone(),
  })
}

/** Cambia la rutina de una sesión planificada, o quita el plan con `null`. */
export function setWorkoutRoutine(id: string, routineId: string | null): Promise<string> {
  return callRpc<string>('set_workout_routine', { id, routine_id: routineId })
}

/** Mueve una sesión planificada (o vuelve a planificar una cancelada) a hoy o un día futuro. */
export function rescheduleWorkout(
  id: string,
  newDate: string,
  requestId: string,
): Promise<MoveResult> {
  return callRpc<MoveResult>('reschedule_workout', {
    id,
    new_date: newDate,
    request_id: requestId,
    client_timezone: timezone(),
  })
}

export function cancelWorkout(id: string): Promise<MoveResult> {
  return callRpc<MoveResult>('cancel_workout', { id })
}

/** Empieza una sesión planificada; `sessionDate` es el día en que se hizo (nulo: hoy). */
export function startPlannedWorkout(
  id: string,
  sessionDate: string | null,
  requestId: string,
): Promise<StartResult> {
  return callRpc<StartResult>('start_planned_workout', {
    id,
    session_date: sessionDate,
    request_id: requestId,
    client_timezone: timezone(),
  })
}

/** Las sesiones entre dos fechas (ambas incluidas), en un orden estable. */
export async function fetchSessionsBetween(from: string, to: string): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(SUMMARY_COLUMNS)
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as SessionSummary[]
}

export const fetchSessionsOfDay = (day: string) => fetchSessionsBetween(day, day)

/** Las planificadas de hoy o de días anteriores («sin registrar»), de la más antigua a la más reciente. */
export async function fetchDueSessions(today: string): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'planned')
    .lte('session_date', today)
    .order('session_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as SessionSummary[]
}

// --- Historia de un ejercicio -------------------------------------------------------------------------------------------

export const HISTORY_PAGE_SIZE = 10

export interface HistoryPage {
  entries: HistoryEntry[]
  total: number
}

/** Las últimas veces que se hizo un ejercicio (sesiones realizadas), de la más reciente a la más antigua. */
export async function fetchExerciseHistory(
  exerciseId: string,
  excludeSessionId: string | null,
  pageSize: number,
  pageOffset: number,
): Promise<HistoryPage> {
  const { data, error } = await supabase.rpc('exercise_history', {
    exercise_id: exerciseId,
    exclude_session_id: excludeSessionId,
    page_size: pageSize,
    page_offset: pageOffset,
  })
  if (error) throw error
  const entries = (data ?? []) as unknown as HistoryEntry[]
  return { entries, total: entries[0]?.total_estimate ?? 0 }
}
