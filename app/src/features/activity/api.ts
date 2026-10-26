import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import { detectDeviceTimezone } from '../../lib/timezone'
import { ACTIVITY_KINDS, type ActivityKind } from './activity'

// Acceso a datos de sueño, pasos y actividad (spec 007). El cliente lee y borra lo propio; guarda y corrige con funciones.

export interface ActivityRecord {
  id: string
  kind: ActivityKind
  value: number
  activity_date: string
  source: string
  note: string | null
}

const COLUMNS = 'id, kind, value, activity_date, source, note'
export const HISTORY_PAGE_SIZE = 20

/** Mensajes seguros para los errores conocidos del servidor; nunca se muestra su texto crudo. */
function activityErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  const match = /invalid_activity:([a-z_]+):/.exec(message)
  if (match) {
    const reasons = es.activity.errors as Record<string, string | undefined>
    return reasons[match[1]!] ?? es.activity.errors.generic
  }
  if (/not_found/i.test(message)) return es.activity.errors.not_found
  return null
}

/** El último registro de cada tipo (o nulo si nunca se registró). */
export async function fetchLatest(): Promise<Record<ActivityKind, ActivityRecord | null>> {
  const rows = await Promise.all(
    ACTIVITY_KINDS.map(async (kind) => {
      const { data, error } = await supabase
        .from('daily_activity')
        .select(COLUMNS)
        .eq('kind', kind)
        .order('activity_date', { ascending: false })
        .limit(1)
      if (error) throw error
      return [kind, data && data[0] ? (data[0] as ActivityRecord) : null] as const
    }),
  )
  return Object.fromEntries(rows) as Record<ActivityKind, ActivityRecord | null>
}

/** El último sueño registrado (o nulo). */
export async function fetchLastSleep(): Promise<ActivityRecord | null> {
  const { data, error } = await supabase
    .from('daily_activity')
    .select(COLUMNS)
    .eq('kind', 'sleep')
    .order('activity_date', { ascending: false })
    .limit(1)
  if (error) throw error
  return data && data[0] ? (data[0] as ActivityRecord) : null
}

/** Una tanda del historial de un tipo, del día más reciente al más antiguo. */
export async function fetchHistory(
  kind: ActivityKind,
  offset: number,
): Promise<{ rows: ActivityRecord[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('daily_activity')
    .select(COLUMNS)
    .eq('kind', kind)
    .order('activity_date', { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE)
  if (error) throw error
  const rows = (data ?? []) as ActivityRecord[]
  return { rows: rows.slice(0, HISTORY_PAGE_SIZE), hasMore: rows.length > HISTORY_PAGE_SIZE }
}

/** Guarda (o reemplaza) el valor de un tipo en un día. Idempotente por `requestId`. */
export function saveActivity(
  input: { kind: ActivityKind; value: number; activityDate: string; note: string },
  requestId: string,
): Promise<ActivityRecord> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('save_activity', {
      kind: input.kind,
      value: input.value,
      activity_date: input.activityDate,
      note: input.note.trim() === '' ? null : input.note.trim(),
      request_id: requestId,
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
    return data as unknown as ActivityRecord
  }, activityErrorMessage)
}

/** Corrige el valor, la fecha y la nota de un registro. */
export function updateActivity(
  id: string,
  input: { value: number; activityDate: string; note: string },
): Promise<ActivityRecord> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('update_activity', {
      id,
      value: input.value,
      activity_date: input.activityDate,
      note: input.note.trim() === '' ? null : input.note.trim(),
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
    return data as unknown as ActivityRecord
  }, activityErrorMessage)
}

export function deleteActivity(id: string): Promise<void> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.from('daily_activity').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('not_found')
  }, activityErrorMessage)
}
