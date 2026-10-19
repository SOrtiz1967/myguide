// T040 (spec 003, FR-023): convertir un ítem manual en los datos de un alimento propio (spec 002).
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { foodFormSchema } from '../../src/features/foods/schema'
import { foodValuesFromEntry } from '../../src/features/meals/saveAsFood'

const entry = {
  food_name: 'Torta de cumpleaños',
  quantity_text: '1 porción' as string | null,
  energy_kcal: 350 as number | null,
  protein_g: 6 as number | null,
  carbs_g: 48 as number | null,
  sugars_g: 30 as number | null,
  fat_g: 15 as number | null,
  saturated_fat_g: 8 as number | null,
  fiber_g: null as number | null,
  sodium_mg: 200 as number | null,
}

const parse = (
  overrides: Partial<typeof entry> = {},
  basis: '100g' | '100ml' = '100g',
  amount = 120,
) => foodFormSchema.safeParse(foodValuesFromEntry({ ...entry, ...overrides }, basis, amount))

describe('foodValuesFromEntry', () => {
  it('normaliza los valores de la cantidad descripta a valores por 100 g', () => {
    const result = parse()
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      name: 'Torta de cumpleaños',
      reference_basis: '100g',
      energy_kcal: 291.67, // 350 × 100 / 120
      protein_g: 5,
      carbs_g: 40,
      sugars_g: 25,
      fat_g: 12.5,
      saturated_fat_g: 6.67,
      sodium_mg: 166.67,
    })
  })

  it('lo que falta en el ítem sigue faltando (null, no 0)', () => {
    expect(parse().data?.fiber_g).toBeNull()
    expect(parse({ protein_g: null }).data?.protein_g).toBeNull()
  })

  it('la cantidad descriptiva pasa a ser una porción del alimento, con el peso informado', () => {
    expect(parse().data?.portions).toEqual([{ name: '1 porción', quantity: 120 }])
  })

  it('sin cantidad descriptiva usa "1 porción"', () => {
    expect(parse({ quantity_text: null }).data?.portions).toEqual([
      { name: '1 porción', quantity: 120 },
    ])
  })

  it('una cantidad descriptiva demasiado larga para ser un nombre de porción se acorta a 80 caracteres', () => {
    const result = parse({ quantity_text: 'x'.repeat(100) })
    expect(result.success).toBe(true)
    expect(result.data?.portions[0]?.name).toHaveLength(80)
  })

  it('para un líquido la base es 100 ml', () => {
    const result = parse({}, '100ml', 200)
    expect(result.data?.reference_basis).toBe('100ml')
    expect(result.data?.energy_kcal).toBe(175)
  })

  it('valida con las reglas de la spec 002: no se puede guardar algo imposible por 100 g', () => {
    const energy = foodFormSchema.safeParse(
      foodValuesFromEntry(
        {
          ...entry,
          energy_kcal: 5000,
          protein_g: null,
          carbs_g: null,
          sugars_g: null,
          fat_g: null,
          saturated_fat_g: null,
        },
        '100g',
        100,
      ),
    )
    expect(energy.success).toBe(false)
    expect(energy.error?.issues[0]?.message).toBe(es.foods.errors.outOfRange('900'))

    const macros = foodFormSchema.safeParse(
      foodValuesFromEntry({ ...entry, protein_g: 100, carbs_g: 100, sugars_g: null }, '100g', 150),
    )
    expect(macros.success).toBe(false)
  })

  it('un ítem sin energía no se puede convertir (la energía es obligatoria en un alimento)', () => {
    const result = parse({ energy_kcal: null })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(es.foods.errors.requiredEnergy)
  })
})
