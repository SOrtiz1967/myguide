import { supabase } from '../../lib/supabase'
import { detectDeviceTimezone } from '../../lib/timezone'
import type { Food } from '../foods/api'
import type { ReferenceBasis } from '../foods/nutrition'
import type { Meal } from './meals'
import { PHOTO_URL_SECONDS, PhotoRequestError } from './photo'
import type { QuantityInput } from './schema'

export type EntryOrigin = 'catalog' | 'own' | 'manual' | 'estimated'
export type EntryStatus = 'confirmed' | 'pending'

/** Un ítem registrado, con la instantánea del alimento y los valores calculados (data-model.md). */
export interface MealEntry {
  id: string
  log_date: string
  meal: Meal
  origin: EntryOrigin
  status: EntryStatus
  food_id: string | null
  food_name: string
  food_brand: string | null
  reference_basis: ReferenceBasis | null
  per100_energy_kcal: number | null
  per100_protein_g: number | null
  per100_carbs_g: number | null
  per100_sugars_g: number | null
  per100_fat_g: number | null
  per100_saturated_fat_g: number | null
  per100_fiber_g: number | null
  per100_sodium_mg: number | null
  quantity: number | null
  portion_name: string | null
  portion_quantity: number | null
  portion_count: number | null
  quantity_text: string | null
  energy_kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  sugars_g: number | null
  fat_g: number | null
  saturated_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  created_at: string
}

/** Un alimento reciente (recent_meal_items): valores calculados con el alimento actual. */
export interface RecentItem {
  food_id: string | null
  origin: EntryOrigin
  food_name: string
  food_brand: string | null
  reference_basis: ReferenceBasis | null
  quantity: number | null
  portion_id: string | null
  portion_name: string | null
  portion_count: number | null
  quantity_text: string | null
  energy_kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  sugars_g: number | null
  fat_g: number | null
  saturated_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  last_logged_at: string
}

export interface ManualEntryInput {
  log_date: string
  meal: Meal
  origin: 'manual'
  description: string
  quantity_text?: string | null
  energy_kcal: number
  protein_g?: number | null
  carbs_g?: number | null
  sugars_g?: number | null
  fat_g?: number | null
  saturated_fat_g?: number | null
  fiber_g?: number | null
  sodium_mg?: number | null
}

export type FoodEntryInput = { log_date: string; meal: Meal; food_id: string } & QuantityInput
export type AddEntryInput = FoodEntryInput | ManualEntryInput

/** Lo que el selector de cantidad necesita de un alimento. */
export type PickerFood = Pick<
  Food,
  | 'reference_basis'
  | 'energy_kcal'
  | 'protein_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sodium_mg'
> & { portions: { id: string; name: string; quantity: number }[] }

const ENTRY_COLUMNS = `
  id, log_date, meal, origin, status, food_id, food_name, food_brand, reference_basis,
  per100_energy_kcal, per100_protein_g, per100_carbs_g, per100_sugars_g, per100_fat_g,
  per100_saturated_fat_g, per100_fiber_g, per100_sodium_mg,
  quantity, portion_name, portion_quantity, portion_count, quantity_text,
  energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg, created_at
`

/** Los ítems de un día, en el orden en que se registraron. RLS deja solo los propios. */
export async function fetchDayEntries(date: string): Promise<MealEntry[]> {
  const { data, error } = await supabase
    .from('meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('log_date', date)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as MealEntry[]
}

export async function fetchRecents(): Promise<RecentItem[]> {
  const { data, error } = await supabase.rpc('recent_meal_items', { max_items: 20 })
  if (error) throw error
  return (data ?? []) as RecentItem[]
}

/** Agrega un ítem. La instantánea del alimento la toma el servidor; `requestId` lo hace idempotente. */
export async function addEntry(input: AddEntryInput, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_meal_entry', {
    entry: input,
    request_id: requestId,
  })
  if (error) throw error
  return data as string
}

/** Un ítem por su identificador, o `null` si no existe o es de otra cuenta (RLS). */
export async function fetchEntry(id: string): Promise<MealEntry | null> {
  const { data, error } = await supabase
    .from('meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    // Un identificador con formato inválido se comporta como un registro inexistente.
    if (error.code === '22P02') return null
    throw error
  }
  return (data ?? null) as unknown as MealEntry | null
}

/** Lo que se puede cambiar de un ítem: solo se envía lo que cambió. */
export interface EntryChanges {
  meal?: Meal
  log_date?: string
  quantity?: number
  portion_id?: string
  portion_count?: number
  description?: string
  quantity_text?: string | null
  energy_kcal?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  sugars_g?: number | null
  fat_g?: number | null
  saturated_fat_g?: number | null
  fiber_g?: number | null
  sodium_mg?: number | null
}

/** Corrige, mueve o edita un ítem. Los valores se recalculan en el servidor desde la instantánea. */
export async function updateEntry(id: string, changes: EntryChanges): Promise<string> {
  const { data, error } = await supabase.rpc('update_meal_entry', { id, changes })
  if (error) throw error
  return data as string
}

/** Elimina un ítem. Un ítem ajeno no afecta ninguna fila (RLS). */
export async function deleteEntry(id: string): Promise<void> {
  const { data, error } = await supabase.from('meal_entries').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not_found')
}

/** Qué día se propone al registrar y si el día anterior todavía se está cerrando (FR-024, FR-025). */
export interface DayStatus {
  today: string
  proposed_date: string
  closing: boolean
}

export async function fetchDayStatus(): Promise<DayStatus> {
  const { data, error } = await supabase.rpc('log_day_status', {
    client_timezone: detectDeviceTimezone(),
  })
  if (error) throw error
  const row = (data as DayStatus[] | null)?.[0]
  if (!row) throw new Error('log_day_status sin resultado')
  return row
}

/** "Empezar el día de hoy": deja de proponer el día que se cierra. Es idempotente. */
export async function startLogDay(day: string): Promise<void> {
  const { error } = await supabase.rpc('start_log_day', {
    day,
    client_timezone: detectDeviceTimezone(),
  })
  if (error) throw error
}

/** Lo que haría repetir una comida: cuántos ítems se recalculan y cuántos se copian (FR-028). */
export interface RepeatPreview {
  total: number
  recalculated: number
  copied: number
}

export interface RepeatResult {
  created: number
  recalculated: number
  copied: number
}

export interface RepeatInput {
  fromDate: string
  fromMeal: Meal
  toDate: string
  toMeal: Meal
}

export async function previewRepeat(fromDate: string, fromMeal: Meal): Promise<RepeatPreview> {
  const { data, error } = await supabase.rpc('preview_repeat_meal', {
    from_date: fromDate,
    from_meal: fromMeal,
  })
  if (error) throw error
  const row = (data as RepeatPreview[] | null)?.[0]
  if (!row) throw new Error('preview_repeat_meal sin resultado')
  return row
}

/** Repite una comida en otro día u otra comida. `requestId` hace seguros los reintentos. */
export async function repeatMeal(input: RepeatInput, requestId: string): Promise<RepeatResult> {
  const { data, error } = await supabase.rpc('repeat_meal', {
    from_date: input.fromDate,
    from_meal: input.fromMeal,
    to_date: input.toDate,
    to_meal: input.toMeal,
    request_id: requestId,
  })
  if (error) throw error
  const row = (data as RepeatResult[] | null)?.[0]
  if (!row) throw new Error('repeat_meal sin resultado')
  return row
}

/** La foto de una comida (FR-030). La ruta no se muestra: se pide una URL firmada y vence a los 10 minutos. */
export interface MealPhotoRow {
  id: string
  log_date: string
  meal: Meal
  storage_path: string
  width: number
  height: number
  bytes: number
}

export async function fetchPhotos(date: string): Promise<MealPhotoRow[]> {
  const { data, error } = await supabase
    .from('meal_photos')
    .select('id, log_date, meal, storage_path, width, height, bytes')
    .eq('log_date', date)
  if (error) throw error
  return (data ?? []) as MealPhotoRow[]
}

export async function photoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('meal-photos')
    .createSignedUrl(path, PHOTO_URL_SECONDS)
  if (error || !data) throw error ?? new Error('sin URL firmada')
  return data.signedUrl
}

async function photoFailure(error: unknown): Promise<Error> {
  const name = (error as { name?: string } | null)?.name
  // La petición no llegó al servidor: se trata como falta de conexión.
  if (name === 'FunctionsFetchError') return new TypeError('Failed to fetch')
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { code?: string }
      return new PhotoRequestError(body.code ?? `http_${context.status}`)
    } catch {
      return new PhotoRequestError(`http_${context.status}`)
    }
  }
  return new PhotoRequestError('unknown')
}

/** Sube (o reemplaza) la foto de una comida. El servidor le quita los metadatos y la guarda en privado. */
export async function uploadPhoto(date: string, meal: Meal, photo: Blob): Promise<void> {
  const body = new FormData()
  body.append('log_date', date)
  body.append('meal', meal)
  body.append('photo', photo, 'foto.jpg')
  const { error } = await supabase.functions.invoke('meal-photo', { method: 'POST', body })
  if (error) throw await photoFailure(error)
}

/** Elimina la foto de una comida. Es idempotente: si no hay foto responde igual. */
export async function deletePhoto(date: string, meal: Meal): Promise<void> {
  const { error } = await supabase.functions.invoke(
    `meal-photo?log_date=${encodeURIComponent(date)}&meal=${encodeURIComponent(meal)}`,
    { method: 'DELETE' },
  )
  if (error) throw await photoFailure(error)
}
