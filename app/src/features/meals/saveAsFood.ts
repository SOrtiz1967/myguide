import type { ReferenceBasis } from '../foods/nutrition'
import { emptyFoodForm, type FoodFormInput } from '../foods/schema'
import type { MealEntry } from './api'

type EntryForFood = Pick<
  MealEntry,
  | 'food_name'
  | 'quantity_text'
  | 'energy_kcal'
  | 'protein_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sodium_mg'
>

const MAX_PORTION_NAME = 80
const DEFAULT_PORTION = '1 porción'

/** 123.456 → "123,46": el texto que usa el formulario de alimentos (coma decimal). */
const asText = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',')

/**
 * Convierte un ítem manual en los valores del formulario de un alimento propio (FR-023).
 * Los valores del ítem corresponden a toda la cantidad descripta; `amount` es cuánto pesa o mide esa
 * cantidad (en g o ml), y con eso se calculan los valores por 100. Lo que falta sigue faltando.
 * El resultado se valida con las mismas reglas que cualquier alimento (`foodFormSchema`).
 */
export function foodValuesFromEntry(
  entry: EntryForFood,
  basis: ReferenceBasis,
  amount: number,
): FoodFormInput {
  const per100 = (value: number | null) => (value === null ? '' : asText((value * 100) / amount))
  const portionName =
    (entry.quantity_text ?? '').trim().slice(0, MAX_PORTION_NAME) || DEFAULT_PORTION
  return {
    ...emptyFoodForm(basis),
    name: entry.food_name,
    energy_kcal: per100(entry.energy_kcal),
    protein_g: per100(entry.protein_g),
    carbs_g: per100(entry.carbs_g),
    sugars_g: per100(entry.sugars_g),
    fat_g: per100(entry.fat_g),
    saturated_fat_g: per100(entry.saturated_fat_g),
    fiber_g: per100(entry.fiber_g),
    sodium_mg: per100(entry.sodium_mg),
    portions: [{ name: portionName, quantity: asText(amount) }],
  }
}
