import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import { detectDeviceTimezone } from '../../lib/timezone'
import { MEASURE_KINDS, type MeasureKind } from './measures'

// Acceso a datos de peso y medidas (spec 008). El cliente lee y borra lo propio; guarda y corrige con funciones.

export interface Measurement {
  id: string
  kind: MeasureKind
  value: number
  measured_on: string
  note: string | null
}

const COLUMNS = 'id, kind, value, measured_on, note'
export const HISTORY_PAGE_SIZE = 20

/** Mensajes seguros para los errores conocidos del servidor; nunca se muestra su texto crudo. */
function measureErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  const match = /invalid_measurement:([a-z_]+):/.exec(message)
  if (match) {
    const reasons = es.measures.errors as Record<string, string | undefined>
    return reasons[match[1]!] ?? es.measures.errors.generic
  }
  if (/not_found/i.test(message)) return es.measures.errors.not_found
  return null
}

const toMeasurement = (row: unknown): Measurement => {
  const r = row as Measurement & { value: number | string }
  return { ...r, value: Number(r.value) }
}

/** El último registro de cada medida (o nulo si nunca se registró). */
export async function fetchLatest(): Promise<Record<MeasureKind, Measurement | null>> {
  const rows = await Promise.all(
    MEASURE_KINDS.map(async (kind) => {
      const { data, error } = await supabase
        .from('body_measurements')
        .select(COLUMNS)
        .eq('kind', kind)
        .order('measured_on', { ascending: false })
        .limit(1)
      if (error) throw error
      return [kind, data && data[0] ? toMeasurement(data[0]) : null] as const
    }),
  )
  return Object.fromEntries(rows) as Record<MeasureKind, Measurement | null>
}

/** El último peso registrado (o nulo). */
export async function fetchLastWeight(): Promise<Measurement | null> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(COLUMNS)
    .eq('kind', 'weight')
    .order('measured_on', { ascending: false })
    .limit(1)
  if (error) throw error
  return data && data[0] ? toMeasurement(data[0]) : null
}

/** Los pesos registrados entre dos fechas (ambas incluidas), del más antiguo al más reciente. */
export async function fetchWeightsBetween(from: string, to: string): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(COLUMNS)
    .eq('kind', 'weight')
    .gte('measured_on', from)
    .lte('measured_on', to)
    .order('measured_on', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toMeasurement)
}

/** Una tanda del historial de una medida, del día más reciente al más antiguo. */
export async function fetchHistory(
  kind: MeasureKind,
  offset: number,
): Promise<{ rows: Measurement[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(COLUMNS)
    .eq('kind', kind)
    .order('measured_on', { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE)
  if (error) throw error
  const rows = (data ?? []).map(toMeasurement)
  return { rows: rows.slice(0, HISTORY_PAGE_SIZE), hasMore: rows.length > HISTORY_PAGE_SIZE }
}

/** Guarda (o reemplaza) el valor de una medida en un día. Idempotente por `requestId`. */
export function saveMeasurement(
  input: { kind: MeasureKind; value: number; measuredOn: string; note: string },
  requestId: string,
): Promise<Measurement> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('save_measurement', {
      kind: input.kind,
      value: input.value,
      measured_on: input.measuredOn,
      note: input.note.trim() === '' ? null : input.note.trim(),
      request_id: requestId,
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
    return toMeasurement(data)
  }, measureErrorMessage)
}

/** Corrige el valor, la fecha y la nota de un registro. */
export function updateMeasurement(
  id: string,
  input: { value: number; measuredOn: string; note: string },
): Promise<Measurement> {
  return saveRemotely(async () => {
    const { data, error } = await supabase.rpc('update_measurement', {
      id,
      value: input.value,
      measured_on: input.measuredOn,
      note: input.note.trim() === '' ? null : input.note.trim(),
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
    return toMeasurement(data)
  }, measureErrorMessage)
}

export function deleteMeasurement(id: string): Promise<void> {
  return saveRemotely(async () => {
    const { data, error } = await supabase
      .from('body_measurements')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('not_found')
  }, measureErrorMessage)
}
