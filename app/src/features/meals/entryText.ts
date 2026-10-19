import { formatAmount } from '../foods/nutrition'
import type { MealEntry } from './api'

const decimals = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/** "150 g", "1,5 × 1 taza (237 g)" o la cantidad descriptiva de un ítem manual. */
export function entryQuantityText(entry: MealEntry): string | null {
  if (entry.quantity !== null && entry.reference_basis) {
    const amount = formatAmount(entry.quantity, entry.reference_basis)
    if (entry.portion_count !== null && entry.portion_name) {
      return `${decimals(entry.portion_count)} × ${entry.portion_name} (${amount})`
    }
    return amount
  }
  return entry.quantity_text
}
