// T037 (spec 003, FR-006, FR-007): validación de la entrada manual, con las mismas reglas que la base.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { emptyManualForm, manualFormSchema } from '../../src/features/meals/schema'

const base = { ...emptyManualForm(), description: 'Torta de cumpleaños', energy_kcal: '350' }
const parse = (overrides: Record<string, unknown> = {}) =>
  manualFormSchema.safeParse({ ...base, ...overrides })

function errorsOf(result: ReturnType<typeof parse>): Record<string, string> {
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('manualFormSchema: valores válidos', () => {
  it('con solo descripción y energía, el resto queda sin dato (null, no 0)', () => {
    expect(parse().data).toEqual({
      description: 'Torta de cumpleaños',
      quantity_text: null,
      energy_kcal: 350,
      protein_g: null,
      carbs_g: null,
      sugars_g: null,
      fat_g: null,
      saturated_fat_g: null,
      fiber_g: null,
      sodium_mg: null,
    })
  })

  it('acepta coma y punto, y recorta espacios', () => {
    const result = parse({
      description: '  Guiso  ',
      quantity_text: ' 1 plato ',
      protein_g: '22,5',
      carbs_g: '40.25',
    })
    expect(result.data?.description).toBe('Guiso')
    expect(result.data?.quantity_text).toBe('1 plato')
    expect(result.data?.protein_g).toBe(22.5)
    expect(result.data?.carbs_g).toBe(40.25)
  })

  it('un cero escrito es un cero real, distinto de un campo vacío', () => {
    const result = parse({ sugars_g: '0', fiber_g: '' })
    expect(result.data?.sugars_g).toBe(0)
    expect(result.data?.fiber_g).toBeNull()
  })

  it('FR-007: una energía que no coincide con los macronutrientes no bloquea', () => {
    expect(parse({ energy_kcal: '900', protein_g: '1', carbs_g: '1', fat_g: '1' }).success).toBe(
      true,
    )
  })

  it('admite los máximos exactos', () => {
    expect(parse({ energy_kcal: '5000', protein_g: '1000', sodium_mg: '50000' }).success).toBe(true)
  })
})

describe('manualFormSchema: valores inválidos', () => {
  it('la descripción es obligatoria y tiene hasta 200 caracteres', () => {
    expect(errorsOf(parse({ description: '   ' })).description).toBe(
      es.meals.manual.errors.descriptionRequired,
    )
    expect(errorsOf(parse({ description: 'x'.repeat(201) })).description).toBe(
      es.meals.manual.errors.descriptionTooLong,
    )
  })

  it('la cantidad descriptiva tiene hasta 60 caracteres', () => {
    expect(errorsOf(parse({ quantity_text: 'x'.repeat(61) })).quantity_text).toBe(
      es.meals.manual.errors.quantityTextTooLong,
    )
  })

  it('la energía es obligatoria', () => {
    expect(errorsOf(parse({ energy_kcal: '' })).energy_kcal).toBe(
      es.meals.manual.errors.energyRequired,
    )
  })

  it('un texto que no es un número indica el campo', () => {
    expect(errorsOf(parse({ protein_g: 'abc' })).protein_g).toBe(es.meals.manual.errors.decimal)
  })

  it('un valor negativo se rechaza', () => {
    expect(errorsOf(parse({ fiber_g: '-1' })).fiber_g).toBe(es.meals.manual.errors.negative)
  })

  it('los rangos: energía hasta 5.000, gramos hasta 1.000, sodio hasta 50.000', () => {
    expect(errorsOf(parse({ energy_kcal: '5001' })).energy_kcal).toBe(
      es.meals.manual.errors.outOfRange('5.000'),
    )
    expect(errorsOf(parse({ protein_g: '1000,5' })).protein_g).toBe(
      es.meals.manual.errors.outOfRange('1.000'),
    )
    expect(errorsOf(parse({ sodium_mg: '50001' })).sodium_mg).toBe(
      es.meals.manual.errors.outOfRange('50.000'),
    )
  })

  it('azúcares no mayores que carbohidratos; saturadas no mayores que grasas', () => {
    expect(errorsOf(parse({ carbs_g: '10', sugars_g: '20' })).sugars_g).toBe(
      es.meals.manual.errors.subtotalOverTotal,
    )
    expect(errorsOf(parse({ fat_g: '5', saturated_fat_g: '6' })).saturated_fat_g).toBe(
      es.meals.manual.errors.subtotalOverTotal,
    )
  })
})
