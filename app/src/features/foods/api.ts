import { supabase } from '../../lib/supabase'
import type { ReferenceBasis } from './nutrition'
import type { FoodPayload } from './schema'

export type FoodOrigin = 'imported' | 'own'
export type NameStatus = 'original' | 'machine_translated' | 'reviewed'
export type SearchScope = 'all' | 'catalog' | 'own'

/** Una fila de resultado de `search_foods` (contracts/database-api.md). */
export interface FoodSummary {
  id: string
  name: string
  name_status: NameStatus
  brand: string | null
  reference_basis: ReferenceBasis
  energy_kcal: number | null
  origin: FoodOrigin
  based_on_food_id: string | null
  source_name: string | null
  total_estimate: number
}

export interface Portion {
  id: string
  name: string
  quantity: number
  position: number
}

export interface FoodSource {
  id: string
  slug: string
  name: string
  license_name: string
  license_url: string
  attribution: string
  source_url: string
  last_imported_at: string | null
  food_count: number
}

export interface Food {
  id: string
  origin: FoodOrigin
  source_item_id: string | null
  imported_at: string | null
  based_on_food_id: string | null
  name: string
  name_status: NameStatus
  brand: string | null
  reference_basis: ReferenceBasis
  energy_kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  sugars_g: number | null
  fat_g: number | null
  saturated_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  portions: Portion[]
  source: Pick<FoodSource, 'id' | 'slug' | 'name'> | null
  based_on: { id: string; name: string } | null
}

export interface SearchParams {
  q: string
  scope: SearchScope
  pageSize: number
  pageOffset: number
}

export async function searchFoods({
  q,
  scope,
  pageSize,
  pageOffset,
}: SearchParams): Promise<FoodSummary[]> {
  const { data, error } = await supabase.rpc('search_foods', {
    q,
    scope,
    page_size: pageSize,
    page_offset: pageOffset,
  })
  if (error) throw error
  return (data ?? []) as FoodSummary[]
}

/** ¿Hay al menos un alimento del catálogo? Distingue "catálogo vacío" de "sin coincidencias". */
export async function catalogHasFoods(): Promise<boolean> {
  const { count, error } = await supabase
    .from('foods')
    .select('id', { count: 'exact', head: true })
    .eq('origin', 'imported')
    .limit(1)
  if (error) throw error
  return (count ?? 0) > 0
}

const FOOD_COLUMNS = `
  id, origin, source_item_id, imported_at, based_on_food_id, name, name_status, brand,
  reference_basis, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g,
  sodium_mg,
  portions:food_portions(id, name, quantity, position),
  source:food_sources(id, slug, name),
  based_on:foods!based_on_food_id(id, name)
`

// Un id con formato inválido (22P02) se comporta como un alimento inexistente.
const INVALID_TEXT_REPRESENTATION = '22P02'

/** El alimento con sus porciones y su fuente, o `null` si no existe o es de otra cuenta (RLS). */
export async function fetchFood(id: string): Promise<Food | null> {
  const { data, error } = await supabase
    .from('foods')
    .select(FOOD_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return null
    throw error
  }
  if (!data) return null
  const food = data as unknown as Food
  return { ...food, portions: [...(food.portions ?? [])].sort((a, b) => a.position - b.position) }
}

/** Crea un alimento propio con sus porciones, de forma atómica e idempotente por `requestId`. */
export async function createFood(payload: FoodPayload, requestId: string): Promise<string> {
  const { portions, ...food } = payload
  const { data, error } = await supabase.rpc('create_food', {
    food,
    portions,
    request_id: requestId,
  })
  if (error) throw error
  return data as string
}

/** Crea una copia propia y editable de un alimento visible (catálogo o propio), idempotente por `requestId`. */
export async function copyFood(id: string, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('copy_food', { id, request_id: requestId })
  if (error) throw error
  return data as string
}

/** Edita un alimento propio y reemplaza sus porciones en la misma operación. */
export async function updateFood(id: string, payload: FoodPayload): Promise<string> {
  const { portions, ...food } = payload
  const { data, error } = await supabase.rpc('update_food', { id, food, portions })
  if (error) throw error
  return data as string
}

/** Elimina un alimento propio. Sus porciones se eliminan con él; las copias que se basaban en él no cambian. */
export async function deleteFood(id: string): Promise<void> {
  const { data, error } = await supabase.from('foods').delete().eq('id', id).select('id')
  if (error) throw error
  // RLS hace que un alimento ajeno o del catálogo no afecte ninguna fila.
  if (!data || data.length === 0) throw new Error('not_found')
}
