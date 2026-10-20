import { es } from '../../copy/es'
import { supabase } from '../../lib/supabase'
import type { OriginScope } from '../../components/OriginTabs'
import type { Equipment, MeasurementType, Muscle } from './exerciseLists'
import type { ExercisePayload } from './schema'

export type ExerciseOrigin = 'imported' | 'own'
export type TextStatus = 'original' | 'machine_translated' | 'reviewed'
export type SearchScope = OriginScope

/** Una fila de resultado de `search_exercises` (contracts/database-api.md). */
export interface ExerciseSummary {
  id: string
  name: string
  name_status: TextStatus
  measurement_type: MeasurementType
  primary_muscles: Muscle[]
  equipment: Equipment | null
  origin: ExerciseOrigin
  based_on_exercise_id: string | null
  source_name: string | null
  total_estimate: number
}

export interface ExerciseSource {
  id: string
  slug: string
  name: string
  license_name: string
  license_url: string
  attribution: string
  source_url: string
  last_imported_at: string | null
  exercise_count: number
}

export interface Exercise {
  id: string
  origin: ExerciseOrigin
  source_item_id: string | null
  imported_at: string | null
  based_on_exercise_id: string | null
  name: string
  name_status: TextStatus
  original_name: string | null
  aliases: string[]
  measurement_type: MeasurementType
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  equipment: Equipment | null
  description: string | null
  description_status: TextStatus | null
  source: Pick<ExerciseSource, 'id' | 'slug' | 'name'> | null
  based_on: { id: string; name: string } | null
}

export interface SearchParams {
  q: string
  scope: SearchScope
  muscle: string | null
  equipment: string | null
  pageSize: number
  pageOffset: number
}

export async function searchExercises({
  q,
  scope,
  muscle,
  equipment,
  pageSize,
  pageOffset,
}: SearchParams): Promise<ExerciseSummary[]> {
  const { data, error } = await supabase.rpc('search_exercises', {
    q: q.trim() === '' ? null : q,
    scope,
    muscle_filter: muscle,
    equipment_filter: equipment,
    page_size: pageSize,
    page_offset: pageOffset,
  })
  if (error) throw error
  return (data ?? []) as ExerciseSummary[]
}

/** ¿Hay al menos un ejercicio del catálogo? Distingue "catálogo vacío" de "sin coincidencias". */
export async function catalogHasExercises(): Promise<boolean> {
  const { count, error } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('origin', 'imported')
    .limit(1)
  if (error) throw error
  return (count ?? 0) > 0
}

const EXERCISE_COLUMNS = `
  id, origin, source_item_id, imported_at, based_on_exercise_id, name, name_status, original_name,
  aliases, measurement_type, primary_muscles, secondary_muscles, equipment, description,
  description_status,
  source:exercise_sources(id, slug, name)
`

// Un id con formato inválido (22P02) se comporta como un ejercicio inexistente.
const INVALID_TEXT_REPRESENTATION = '22P02'

/** El ejercicio con su fuente, o `null` si no existe o es de otra cuenta (RLS). */
export async function fetchExercise(id: string): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return null
    throw error
  }
  if (!data) return null
  const exercise = data as unknown as Omit<Exercise, 'based_on'>
  return { ...exercise, based_on: await fetchOriginal(exercise.based_on_exercise_id) }
}

// Se pide aparte y no con un embed: en una relación de la tabla consigo misma PostgREST no distingue
// si se pide el original o las copias, y devolvería lo equivocado.
async function fetchOriginal(id: string | null): Promise<Exercise['based_on']> {
  if (!id) return null
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? { id: data.id as string, name: data.name as string } : null
}

const EXERCISE_ERRORS: Record<string, string> = {
  name_required: es.exercises.errors.nameRequired,
  name_too_long: es.exercises.errors.nameTooLong,
  measurement_required: es.exercises.errors.measurementRequired,
  invalid_measurement: es.exercises.errors.measurementRequired,
  too_many_muscles: es.exercises.errors.tooManyPrimary,
  muscle_repeated: es.exercises.errors.muscleRepeated,
  description_too_long: es.exercises.errors.descriptionTooLong,
  too_many_aliases: es.exercises.errors.tooManyAliases,
  alias_too_long: es.exercises.errors.aliasTooLong,
}

/**
 * Traduce un error conocido del servidor (`invalid_exercise:<motivo>:<campo>`, `query_too_short`...) a un
 * mensaje claro. Devuelve `null` si no lo reconoce: quien llama usa entonces el mensaje general.
 * Nunca se muestra el texto crudo del servidor.
 */
export function exerciseErrorMessage(error: unknown): string | null {
  const message = (error as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null
  if (message.startsWith('session_expired')) return es.auth.sessionExpired
  if (message.startsWith('query_too_short')) return es.exercises.searchTooShort
  if (message.startsWith('invalid_filter') || message.startsWith('invalid_scope')) {
    return es.exercises.searchError
  }
  if (message.startsWith('not_found')) return es.exercises.notFound
  const match = /^invalid_exercise:([a-z_]+):/.exec(message)
  if (match) {
    const reason = match[1]!
    if (reason === 'too_many_muscles' && message.includes('secondary')) {
      return es.exercises.errors.tooManySecondary
    }
    return EXERCISE_ERRORS[reason] ?? es.exercises.errors.saveFailed
  }
  return null
}

/** Crea un ejercicio propio, de forma atómica e idempotente por `requestId`. Devuelve su identificador. */
export async function createExercise(payload: ExercisePayload, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_exercise', {
    exercise: payload,
    request_id: requestId,
  })
  if (error) throw error
  return data as string
}
