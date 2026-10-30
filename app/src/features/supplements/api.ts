import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import { detectDeviceTimezone } from '../../lib/timezone'

// Acceso a datos de suplementación (spec 022). El cliente lee y borra lo propio; crear, corregir, archivar y marcar pasan
// por funciones del servidor. Los errores llegan como `invalid_supplement:<motivo>:<campo>` y nunca se muestran crudos.

export interface Supplement {
  id: string
  name: string
  dose: string | null
  archived_at: string | null
}

/** Tope de suplementos sin archivar por cuenta (FR-004); el servidor lo hace valer, aquí solo se avisa antes. */
export const MAX_ACTIVE = 30

const COLUMNS = 'id, name, dose, archived_at'

function supplementErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  const match = /invalid_supplement:([a-z_]+):/.exec(message)
  if (match) {
    const reasons = es.supplements.errors as Record<string, string | undefined>
    return reasons[match[1]!] ?? es.supplements.errors.generic
  }
  if (/not_found/i.test(message)) return es.supplements.errors.not_found
  return null
}

const toSupplement = (row: unknown): Supplement => {
  const r = row as {
    id: string
    name: string
    dose: string | null
    archived?: boolean
    archived_at?: string | null
  }
  return {
    id: r.id,
    name: r.name,
    dose: r.dose,
    archived_at: r.archived_at ?? (r.archived ? 'archivado' : null),
  }
}

/** Todos los suplementos de la persona (también los archivados), por nombre. */
export async function fetchSupplements(): Promise<Supplement[]> {
  const { data, error } = await supabase
    .from('supplements')
    .select(COLUMNS)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toSupplement)
}

/** Los ids de los suplementos marcados como tomados en un día. */
export async function fetchMarks(date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('supplement_marks')
    .select('supplement_id')
    .eq('taken_on', date)
  if (error) throw error
  return (data ?? []).map((row) => (row as { supplement_id: string }).supplement_id)
}

export function createSupplement(
  input: { name: string; dose: string },
  requestId: string,
): Promise<Supplement> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('create_supplement', {
      name: input.name,
      dose: input.dose.trim() === '' ? null : input.dose,
      request_id: requestId,
    })
    if (error) throw error
    return toSupplement(data)
  }, supplementErrorMessage)
}

export function updateSupplement(
  id: string,
  input: { name: string; dose: string },
): Promise<Supplement> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('update_supplement', {
      id,
      name: input.name,
      dose: input.dose.trim() === '' ? null : input.dose,
    })
    if (error) throw error
    return toSupplement(data)
  }, supplementErrorMessage)
}

export function setSupplementArchived(id: string, archived: boolean): Promise<Supplement> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('set_supplement_archived', { id, archived })
    if (error) throw error
    return toSupplement(data)
  }, supplementErrorMessage)
}

export function deleteSupplement(id: string): Promise<void> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.from('supplements').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('not_found')
  }, supplementErrorMessage)
}

/** Marca (o quita la marca de) un suplemento en un día. */
export function setSupplementTaken(id: string, date: string, taken: boolean): Promise<void> {
  return saveRemotely(async () => {
    const { error } = await supabase.rpc('set_supplement_taken', {
      supplement_id: id,
      taken_on: date,
      taken,
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
  }, supplementErrorMessage)
}
