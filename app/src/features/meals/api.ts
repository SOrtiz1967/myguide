import { supabase } from '../../lib/supabase'
import type { Food } from '../foods/api'
import type { ReferenceBasis } from '../foods/nutrition'
import type { Meal } from './meals'
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
