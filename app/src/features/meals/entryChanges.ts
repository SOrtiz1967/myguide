import type { EntryChanges, MealEntry } from './api'
import type { Meal } from './meals'
import type { ManualPayload, QuantityInput } from './schema'

/** Lo que cambió de un ítem que viene de un alimento: solo eso se envía al servidor. */
export function foodEntryChanges(
  entry: Pick<MealEntry, 'meal' | 'log_date' | 'quantity' | 'portion_name' | 'portion_count'>,
  next: { meal: Meal; log_date: string; originalPortionId: string; quantity: QuantityInput },
): EntryChanges {
  const changes: EntryChanges = {}
  if (next.meal !== entry.meal) changes.meal = next.meal
  if (next.log_date !== entry.log_date) changes.log_date = next.log_date

  const wanted = next.quantity
  if ('quantity' in wanted) {
    if (entry.portion_name !== null || wanted.quantity !== entry.quantity) {
      changes.quantity = wanted.quantity
    }
  } else if (wanted.portion_id === next.originalPortionId && entry.portion_name !== null) {
    if (wanted.portion_count !== entry.portion_count) changes.portion_count = wanted.portion_count
  } else {
    changes.portion_id = wanted.portion_id
    changes.portion_count = wanted.portion_count
  }
  return changes
}

type ManualEntryValues = Pick<
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

const VALUE_KEYS = [
  'energy_kcal',
  'protein_g',
  'carbs_g',
  'sugars_g',
  'fat_g',
  'saturated_fat_g',
  'fiber_g',
  'sodium_mg',
] as const

/** Lo que cambió de un ítem manual. Un valor que se borra viaja como `null` (sin dato). */
export function manualEntryChanges(entry: ManualEntryValues, payload: ManualPayload): EntryChanges {
  const changes: EntryChanges = {}
  if (payload.description !== entry.food_name) changes.description = payload.description
  if (payload.quantity_text !== (entry.quantity_text ?? null)) {
    changes.quantity_text = payload.quantity_text
  }
  for (const key of VALUE_KEYS) {
    if (payload[key] !== entry[key]) changes[key] = payload[key]
  }
  return changes
}
