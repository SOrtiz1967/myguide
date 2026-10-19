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
