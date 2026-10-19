import { z } from 'zod'
import { es } from '../../copy/es'
import type { Food } from './api'
import { parseDecimal, type NutrientKey, type ReferenceBasis } from './nutrition'

// Las mismas reglas que `private.validate_food_input` y las restricciones de la tabla, para que la
// persona vea el error al escribir y no recién al guardar (FR-017).

export const MAX_NAME = 200
export const MAX_BRAND = 120
export const MAX_PORTION_NAME = 80
export const MAX_PORTIONS = 20
export const MAX_PORTION_QUANTITY = 5000

/** Máximo de cada nutriente, tal como lo exige la base de datos. */
const MAX_BY_NUTRIENT: Record<NutrientKey, { value: number; label: string }> = {
  energy_kcal: { value: 900, label: '900' },
  protein_g: { value: 100, label: '100' },
  carbs_g: { value: 100, label: '100' },
  sugars_g: { value: 100, label: '100' },
  fat_g: { value: 100, label: '100' },
  saturated_fat_g: { value: 100, label: '100' },
  fiber_g: { value: 100, label: '100' },
  sodium_mg: { value: 40000, label: '40.000' },
}

const NUTRIENT_KEYS = Object.keys(MAX_BY_NUTRIENT) as NutrientKey[]

const textField = z.string()

const nutrientFields = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, textField])) as Record<
  NutrientKey,
  typeof textField
>

const formObject = z.object({
  name: textField,
  brand: textField,
  reference_basis: z.enum(['100g', '100ml']),
  ...nutrientFields,
  portions: z.array(z.object({ name: textField, quantity: textField })),
})

export type FoodFormInput = z.input<typeof formObject>

/** Lo que recibe `create_food` y `update_food`. */
export interface FoodPayload {
  name: string
  brand: string | null
  reference_basis: ReferenceBasis
  energy_kcal: number
  protein_g: number | null
  carbs_g: number | null
  sugars_g: number | null
  fat_g: number | null
  saturated_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  portions: { name: string; quantity: number }[]
}

export const foodFormSchema = formObject
  .superRefine((values, ctx) => {
    const fail = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })

    const name = values.name.trim()
    if (name === '') fail(['name'], es.foods.errors.nameRequired)
    else if (name.length > MAX_NAME) fail(['name'], es.foods.errors.nameTooLong)
    if (values.brand.trim().length > MAX_BRAND) fail(['brand'], es.foods.errors.brandTooLong)

    const numbers: Partial<Record<NutrientKey, number>> = {}
    for (const key of NUTRIENT_KEYS) {
      const parsed = parseDecimal(values[key])
      if (!parsed.valid) {
        fail([key], es.foods.errors.decimal)
        continue
      }
      if (parsed.value === null) {
        if (key === 'energy_kcal') fail([key], es.foods.errors.requiredEnergy)
        continue
      }
      if (parsed.value < 0) fail([key], es.foods.errors.negative)
      else if (parsed.value > MAX_BY_NUTRIENT[key].value) {
        fail([key], es.foods.errors.outOfRange(MAX_BY_NUTRIENT[key].label))
      } else numbers[key] = parsed.value
    }

    const { protein_g, carbs_g, fat_g, sugars_g, saturated_fat_g } = numbers
    if ((protein_g ?? 0) + (carbs_g ?? 0) + (fat_g ?? 0) > 100) {
      fail(['protein_g'], es.foods.errors.macrosOver100)
    }
    if (sugars_g !== undefined && carbs_g !== undefined && sugars_g > carbs_g) {
      fail(['sugars_g'], es.foods.errors.subtotalOverTotal)
    }
    if (saturated_fat_g !== undefined && fat_g !== undefined && saturated_fat_g > fat_g) {
      fail(['saturated_fat_g'], es.foods.errors.subtotalOverTotal)
    }

    if (values.portions.length > MAX_PORTIONS) fail(['portions'], es.foods.errors.tooManyPortions)
    const seen = new Set<string>()
    values.portions.forEach((portion, index) => {
      const portionName = portion.name.trim()
      if (portionName === '' || portionName.length > MAX_PORTION_NAME) {
        fail(['portions', index, 'name'], es.foods.errors.portionName)
      } else if (seen.has(portionName.toLowerCase())) {
        fail(['portions', index, 'name'], es.foods.errors.portionDuplicate)
      }
      seen.add(portionName.toLowerCase())

      const quantity = parseDecimal(portion.quantity)
      if (
        !quantity.valid ||
        quantity.value === null ||
        quantity.value <= 0 ||
        quantity.value > MAX_PORTION_QUANTITY
      ) {
        fail(['portions', index, 'quantity'], es.foods.errors.portionAmount)
      }
    })
  })
  .transform((values): FoodPayload => {
    const value = (key: NutrientKey): number | null => {
      const parsed = parseDecimal(values[key])
      return parsed.valid ? parsed.value : null
    }
    return {
      name: values.name.trim(),
      brand: values.brand.trim() === '' ? null : values.brand.trim(),
      reference_basis: values.reference_basis,
      energy_kcal: value('energy_kcal') ?? 0,
      protein_g: value('protein_g'),
      carbs_g: value('carbs_g'),
      sugars_g: value('sugars_g'),
      fat_g: value('fat_g'),
      saturated_fat_g: value('saturated_fat_g'),
      fiber_g: value('fiber_g'),
      sodium_mg: value('sodium_mg'),
      portions: values.portions.map((portion) => ({
        name: portion.name.trim(),
        quantity: quantityValue(portion.quantity),
      })),
    }
  })

function quantityValue(text: string): number {
  const parsed = parseDecimal(text)
  return parsed.valid && parsed.value !== null ? parsed.value : 0
}

/** Forma de un borrador: solo texto, sin reglas de negocio (puede estar a medio escribir). */
export const foodDraftSchema = formObject

export function emptyFoodForm(basis: ReferenceBasis = '100g'): FoodFormInput {
  return {
    name: '',
    brand: '',
    reference_basis: basis,
    energy_kcal: '',
    protein_g: '',
    carbs_g: '',
    sugars_g: '',
    fat_g: '',
    saturated_fat_g: '',
    fiber_g: '',
    sodium_mg: '',
    portions: [],
  }
}

const toText = (value: number | null): string =>
  value === null ? '' : String(value).replace('.', ',')

/** Valores del formulario a partir de un alimento guardado (para editar o copiar). */
export function foodToFormValues(food: Food): FoodFormInput {
  return {
    name: food.name,
    brand: food.brand ?? '',
    reference_basis: food.reference_basis,
    energy_kcal: toText(food.energy_kcal),
    protein_g: toText(food.protein_g),
    carbs_g: toText(food.carbs_g),
    sugars_g: toText(food.sugars_g),
    fat_g: toText(food.fat_g),
    saturated_fat_g: toText(food.saturated_fat_g),
    fiber_g: toText(food.fiber_g),
    sodium_mg: toText(food.sodium_mg),
    portions: food.portions.map((portion) => ({
      name: portion.name,
      quantity: toText(portion.quantity),
    })),
  }
}
