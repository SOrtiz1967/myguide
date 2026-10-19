// Subtotales y totales del día (Principio VII: funciones puras, separadas de la presentación).
// Un valor que falta es `null`, nunca 0: el total lo dice ("al menos 45 g · falta en 2 ítems").
import { formatValue, type Unit } from '../foods/nutrition'

export type TotalKey = 'energy_kcal' | 'protein_g' | 'carbs_g' | 'fat_g'

export const TOTAL_KEYS: readonly TotalKey[] = ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g']

/** Los valores de un ítem que entran en los totales. */
export type EntryValues = Record<TotalKey, number | null>

export interface Total {
  /** Suma de lo informado; `null` si ningún ítem informa el nutriente. */
  value: number | null
  /** Cuántos ítems no informan el nutriente. */
  missing: number
  /** Cuántos ítems hay. */
  count: number
  /** Todos los ítems lo informan (y hay al menos uno). */
  complete: boolean
}

/** Quita el error de punto flotante de una suma de decimales (0,1 + 0,2 = 0,3). */
const clean = (value: number) => Math.round(value * 1e6) / 1e6

function sumKey(entries: EntryValues[], key: TotalKey): Total {
  let sum = 0
  let informed = 0
  for (const entry of entries) {
    const value = entry[key]
    if (value === null) continue
    sum += value
    informed++
  }
  const missing = entries.length - informed
  return {
    value: informed === 0 ? null : clean(sum),
    missing,
    count: entries.length,
    complete: entries.length > 0 && missing === 0,
  }
}

/** Totales de energía, proteínas, carbohidratos y grasas. La suma se hace antes de redondear. */
export function sumEntries(entries: EntryValues[]): Record<TotalKey, Total> {
  return {
    energy_kcal: sumKey(entries, 'energy_kcal'),
    protein_g: sumKey(entries, 'protein_g'),
    carbs_g: sumKey(entries, 'carbs_g'),
    fat_g: sumKey(entries, 'fat_g'),
  }
}

/** "1.250 kcal", "al menos 45 g · falta en 2 ítems" o "sin dato" (FR-015, FR-016). */
export function formatTotal(total: Total, unit: Unit): string {
  if (total.value === null) return formatValue(null, unit)
  const text = formatValue(total.value, unit)
  if (total.complete || total.missing === 0) return text
  const items = total.missing === 1 ? 'ítem' : 'ítems'
  return `al menos ${text} · falta en ${total.missing} ${items}`
}
