import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import { detectDeviceTimezone } from '../../lib/timezone'
import type { GoalChange } from './goalHistory'

/** Tope defensivo de la consulta: el historial real son unas pocas filas por año. */
const HISTORY_LIMIT = 1000

/** Todos los cambios del objetivo de la cuenta (RLS deja solo los propios), del más nuevo al más viejo. */
export async function fetchGoalHistory(): Promise<GoalChange[]> {
  const { data, error } = await supabase
    .from('energy_goals')
    .select('effective_from, kcal, created_at')
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw error
  return (data ?? []) as GoalChange[]
}

export interface SavedGoal {
  effective_from: string
  kcal: number | null
}

/** Mensajes seguros para los errores conocidos del servidor; nunca se muestra su texto crudo. */
function goalErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  if (/invalid_goal:out_of_range/i.test(message)) return es.goal.validation.range
  return null
}

/**
 * Fija, cambia o quita (`kcal = null`) el objetivo. El servidor decide desde qué día rige y es
 * idempotente por `requestId`: reintentar con el mismo identificador no agrega otro cambio.
 */
export async function saveGoal(kcal: number | null, requestId: string): Promise<SavedGoal> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('set_energy_goal', {
      kcal,
      request_id: requestId,
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
    return data as unknown as SavedGoal
  }, goalErrorMessage)
}
