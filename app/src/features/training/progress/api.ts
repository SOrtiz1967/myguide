import { supabase } from '../../../lib/supabase'
import type { ProgressRow } from './series'

/** Las sesiones realizadas donde se registró un ejercicio, en orden cronológico (contrato: exercise_progress). */
export async function fetchExerciseProgress(exerciseId: string): Promise<ProgressRow[]> {
  const { data, error } = await supabase.rpc('exercise_progress', { exercise_id: exerciseId })
  if (error) throw error
  return (data ?? []) as unknown as ProgressRow[]
}

/** Los días de las sesiones realizadas, desde un día (o desde el principio). Solo lee `session_date`. */
export async function fetchCompletedDates(from: string | null): Promise<string[]> {
  let query = supabase
    .from('workout_sessions')
    .select('session_date')
    .eq('status', 'completed')
    .order('session_date')
    .limit(5000)
  if (from) query = query.gte('session_date', from)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => row.session_date as string)
}
