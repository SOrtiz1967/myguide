import { es } from '../../../copy/es'
import type { ManualFormInput } from '../schema'
import { EstimateError, type EstimatedItem } from './api'

export const MAX_TEXT = 500

const toText = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

/** Un ítem propuesto como valores de formulario, para que la persona lo corrija como cualquier alta a mano. */
export function itemToForm(item: EstimatedItem): ManualFormInput {
  return {
    description: item.name,
    quantity_text: item.quantity_text ?? '',
    energy_kcal: toText(item.energy_kcal),
    protein_g: toText(item.protein_g),
    carbs_g: toText(item.carbs_g),
    sugars_g: '',
    fat_g: toText(item.fat_g),
    saturated_fat_g: '',
    fiber_g: '',
    sodium_mg: '',
  }
}

/** Junta varios ítems en uno (energía y macros sumados; un dato queda vacío solo si ningún ítem lo trae). */
export function mergeItems(items: EstimatedItem[]): EstimatedItem | null {
  if (items.length === 0) return null
  const sum = (pick: (item: EstimatedItem) => number | null): number | null => {
    const values = items.map(pick).filter((value): value is number => value !== null)
    return values.length === 0
      ? null
      : Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10
  }
  const first = items[0]!
  return {
    name: first.name,
    quantity_text: first.quantity_text,
    energy_kcal: sum((item) => item.energy_kcal) ?? 0,
    protein_g: sum((item) => item.protein_g),
    carbs_g: sum((item) => item.carbs_g),
    fat_g: sum((item) => item.fat_g),
  }
}

/** Texto para el aviso de un fallo de la estimación (sin culpa, siempre con el camino manual a la vista). */
export function estimateErrorMessage(error: unknown): string {
  const messages = es.meals.ai.errors as Record<string, unknown>
  if (error instanceof EstimateError) {
    if (error.code === 'offline') return es.meals.ai.errors.offline
    if (error.code === 'http_401' || error.code === 'unauthorized') {
      return es.meals.ai.errors.unauthorized
    }
    const known = messages[error.code]
    if (typeof known === 'string') return known
  }
  // Una petición que ni salió del navegador también es falta de conexión.
  if (error instanceof TypeError) return es.meals.ai.errors.offline
  return es.meals.ai.errors.generic
}

/** Total de energía de los ítems con un valor válido, ya formateado. */
export function totalEnergyText(energies: (number | null)[]): string {
  const total = energies.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  return Math.round(total).toLocaleString('es-AR')
}
