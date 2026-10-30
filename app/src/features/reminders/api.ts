import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import { detectDeviceTimezone } from '../../lib/timezone'
import type { Frequency, Reminder, ReminderKind } from './due'

// Acceso a datos de los recordatorios (spec 021). El cliente lee lo propio; configurar y posponer pasan por funciones del
// servidor. Los errores llegan como `invalid_reminder:<motivo>:<campo>` y nunca se muestran crudos.

const COLUMNS = 'kind, enabled, frequency, every_n, weekdays, snoozed_until'

function reminderErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  const match = /invalid_reminder:([a-z_]+):/.exec(message)
  if (match) {
    const reasons = es.reminders.errors as Record<string, string | undefined>
    return reasons[match[1]!] ?? es.reminders.errors.generic
  }
  if (/not_found/i.test(message)) return es.reminders.errors.not_found
  return null
}

/** Los recordatorios configurados (a lo sumo uno por tipo). */
export async function fetchReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase.from('reminders').select(COLUMNS)
  if (error) throw error
  return (data ?? []) as Reminder[]
}

export interface ReminderInput {
  kind: ReminderKind
  enabled: boolean
  frequency: Frequency
  everyN: number | null
  weekdays: number[] | null
}

export function saveReminder(input: ReminderInput): Promise<void> {
  return saveRemotely(async () => {
    const { error } = await supabase.rpc('set_reminder', {
      kind: input.kind,
      enabled: input.enabled,
      frequency: input.frequency,
      every_n: input.frequency === 'every_n_days' ? input.everyN : null,
      weekdays: input.frequency === 'weekdays' ? input.weekdays : null,
    })
    if (error) throw error
  }, reminderErrorMessage)
}

/** «Más tarde»: oculta el aviso hasta mañana. */
export function snoozeReminder(kind: ReminderKind): Promise<void> {
  return saveRemotely(async () => {
    const { error } = await supabase.rpc('snooze_reminder', {
      kind,
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
  }, reminderErrorMessage)
}

/** La fecha de la última foto de progreso, o nulo si no hay ninguna. */
export async function fetchLastPhotoDate(): Promise<string | null> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('taken_on')
    .order('taken_on', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as { taken_on: string } | undefined)?.taken_on ?? null
}
