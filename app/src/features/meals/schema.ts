import { z } from 'zod'
import { es } from '../../copy/es'
import { parseDecimal } from '../foods/nutrition'

// Las mismas reglas que add_meal_entry en la base de datos (FR-003), para que la persona vea el error al
// escribir y no recién al guardar.

export const MAX_QUANTITY = 5000
export const MAX_PORTION_COUNT = 50

/** Texto del selector de medida (`portion` vacío = gramos o mililitros) y de la cantidad. */
export const quantityFormSchema = z
  .object({ portion: z.string(), amount: z.string() })
  .superRefine((values, ctx) => {
    const parsed = parseDecimal(values.amount)
    const value = parsed.valid ? parsed.value : null
    const byPortion = values.portion !== ''
    const max = byPortion ? MAX_PORTION_COUNT : MAX_QUANTITY
    if (value === null || value <= 0 || value > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: byPortion ? es.meals.errors.portionCount : es.meals.errors.quantity,
      })
    }
  })
  .transform((values): QuantityInput => {
    const parsed = parseDecimal(values.amount)
    const value = parsed.valid && parsed.value !== null ? parsed.value : 0
    return values.portion === ''
      ? { quantity: value }
      : { portion_id: values.portion, portion_count: value }
  })

export type QuantityFormInput = z.input<typeof quantityFormSchema>
export type QuantityInput = { quantity: number } | { portion_id: string; portion_count: number }

// ---- entrada manual (FR-006) -----------------------------------------------------------------------------

export const MAX_DESCRIPTION = 200
export const MAX_QUANTITY_TEXT = 60

type ManualNutrient =
  | 'energy_kcal'
  | 'protein_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sodium_mg'

/** Máximo de cada valor escrito a mano, como lo exige la base (validate_manual_values). */
const MANUAL_MAX: Record<ManualNutrient, { value: number; label: string }> = {
  energy_kcal: { value: 5000, label: '5.000' },
  protein_g: { value: 1000, label: '1.000' },
  carbs_g: { value: 1000, label: '1.000' },
  sugars_g: { value: 1000, label: '1.000' },
  fat_g: { value: 1000, label: '1.000' },
  saturated_fat_g: { value: 1000, label: '1.000' },
  fiber_g: { value: 1000, label: '1.000' },
  sodium_mg: { value: 50000, label: '50.000' },
}
export const MANUAL_NUTRIENTS = Object.keys(MANUAL_MAX) as ManualNutrient[]

const manualObject = z.object({
  description: z.string(),
  quantity_text: z.string(),
  energy_kcal: z.string(),
  protein_g: z.string(),
  carbs_g: z.string(),
  sugars_g: z.string(),
  fat_g: z.string(),
  saturated_fat_g: z.string(),
  fiber_g: z.string(),
  sodium_mg: z.string(),
})

export type ManualFormInput = z.input<typeof manualObject>

/** Lo que se manda a `add_meal_entry` además del día, la comida y el origen. */
export interface ManualPayload {
  description: string
  quantity_text: string | null
  energy_kcal: number
  protein_g: number | null
  carbs_g: number | null
  sugars_g: number | null
  fat_g: number | null
  saturated_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
}

export const manualFormSchema = manualObject
  .superRefine((values, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    const errors = es.meals.manual.errors

    const description = values.description.trim()
    if (description === '') fail('description', errors.descriptionRequired)
    else if (description.length > MAX_DESCRIPTION) fail('description', errors.descriptionTooLong)
    if (values.quantity_text.trim().length > MAX_QUANTITY_TEXT) {
      fail('quantity_text', errors.quantityTextTooLong)
    }

    const numbers: Partial<Record<ManualNutrient, number>> = {}
    for (const key of MANUAL_NUTRIENTS) {
      const parsed = parseDecimal(values[key])
      if (!parsed.valid) {
        fail(key, errors.decimal)
        continue
      }
      if (parsed.value === null) {
        if (key === 'energy_kcal') fail(key, errors.energyRequired)
        continue
      }
      if (parsed.value < 0) fail(key, errors.negative)
      else if (parsed.value > MANUAL_MAX[key].value)
        fail(key, errors.outOfRange(MANUAL_MAX[key].label))
      else numbers[key] = parsed.value
    }
    if (
      numbers.sugars_g !== undefined &&
      numbers.carbs_g !== undefined &&
      numbers.sugars_g > numbers.carbs_g
    ) {
      fail('sugars_g', errors.subtotalOverTotal)
    }
    if (
      numbers.saturated_fat_g !== undefined &&
      numbers.fat_g !== undefined &&
      numbers.saturated_fat_g > numbers.fat_g
    ) {
      fail('saturated_fat_g', errors.subtotalOverTotal)
    }
  })
  .transform((values): ManualPayload => {
    const value = (key: ManualNutrient): number | null => {
      const parsed = parseDecimal(values[key])
      return parsed.valid ? parsed.value : null
    }
    const quantityText = values.quantity_text.trim()
    return {
      description: values.description.trim(),
      quantity_text: quantityText === '' ? null : quantityText,
      energy_kcal: value('energy_kcal') ?? 0,
      protein_g: value('protein_g'),
      carbs_g: value('carbs_g'),
      sugars_g: value('sugars_g'),
      fat_g: value('fat_g'),
      saturated_fat_g: value('saturated_fat_g'),
      fiber_g: value('fiber_g'),
      sodium_mg: value('sodium_mg'),
    }
  })

export const manualDraftSchema = manualObject

export function emptyManualForm(): ManualFormInput {
  return {
    description: '',
    quantity_text: '',
    energy_kcal: '',
    protein_g: '',
    carbs_g: '',
    sugars_g: '',
    fat_g: '',
    saturated_fat_g: '',
    fiber_g: '',
    sodium_mg: '',
  }
}
