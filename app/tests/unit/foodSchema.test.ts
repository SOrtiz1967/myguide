// T031 (spec 002, FR-015 a FR-019): validación del formulario de alimentos, con las mismas reglas que la base.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { emptyFoodForm, foodFormSchema } from '../../src/features/foods/schema'

const base = { ...emptyFoodForm('100g'), name: 'Mi galletita', energy_kcal: '450' }

const parse = (overrides: Record<string, unknown> = {}) =>
  foodFormSchema.safeParse({ ...base, ...overrides })

/** Mensajes de error por ruta ("energy_kcal", "portions.0.name"). */
function errorsOf(result: ReturnType<typeof parse>): Record<string, string> {
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('foodFormSchema: valores válidos', () => {
  it('FR-015: solo con nombre y energía es válido y el resto queda sin dato (null, no 0)', () => {
    const result = parse()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      name: 'Mi galletita',
      brand: null,
      reference_basis: '100g',
      energy_kcal: 450,
      protein_g: null,
      carbs_g: null,
      sugars_g: null,
      fat_g: null,
      saturated_fat_g: null,
      fiber_g: null,
      sodium_mg: null,
      portions: [],
    })
  })

  it('FR-019: acepta coma y punto decimal', () => {
    const result = parse({ protein_g: '12,5', carbs_g: '30.25' })
    expect(result.success).toBe(true)
    expect(result.data?.protein_g).toBe(12.5)
    expect(result.data?.carbs_g).toBe(30.25)
  })

  it('recorta los espacios del nombre y de la marca; una marca vacía es null', () => {
    const result = parse({ name: '  Pan lactal  ', brand: '   ' })
    expect(result.data?.name).toBe('Pan lactal')
    expect(result.data?.brand).toBeNull()
    expect(parse({ brand: ' Bimbo ' }).data?.brand).toBe('Bimbo')
  })

  it('un cero escrito es un cero real, distinto de un campo vacío', () => {
    const result = parse({ sugars_g: '0', fiber_g: '' })
    expect(result.data?.sugars_g).toBe(0)
    expect(result.data?.fiber_g).toBeNull()
  })

  it('la base puede ser 100 ml', () => {
    expect(parse({ reference_basis: '100ml' }).data?.reference_basis).toBe('100ml')
  })

  it('FR-018: una energía que no coincide con los macronutrientes NO bloquea el guardado', () => {
    const result = parse({ energy_kcal: '900', protein_g: '1', carbs_g: '1', fat_g: '1' })
    expect(result.success).toBe(true)
  })

  it('proteínas + carbohidratos + grasas iguales a 100 son válidos', () => {
    expect(parse({ protein_g: '50', carbs_g: '30', fat_g: '20' }).success).toBe(true)
  })
})

describe('foodFormSchema: valores inválidos (FR-017)', () => {
  it('el nombre es obligatorio y tiene hasta 200 caracteres', () => {
    expect(errorsOf(parse({ name: '   ' })).name).toBe(es.foods.errors.nameRequired)
    expect(errorsOf(parse({ name: 'x'.repeat(201) })).name).toBe(es.foods.errors.nameTooLong)
    expect(parse({ name: 'x'.repeat(200) }).success).toBe(true)
  })

  it('la marca tiene hasta 120 caracteres', () => {
    expect(errorsOf(parse({ brand: 'x'.repeat(121) })).brand).toBe(es.foods.errors.brandTooLong)
  })

  it('la energía es obligatoria', () => {
    expect(errorsOf(parse({ energy_kcal: '' })).energy_kcal).toBe(es.foods.errors.requiredEnergy)
    expect(errorsOf(parse({ energy_kcal: '  ' })).energy_kcal).toBe(es.foods.errors.requiredEnergy)
  })

  it('un texto que no es un número indica el campo', () => {
    expect(errorsOf(parse({ protein_g: 'abc' })).protein_g).toBe(es.foods.errors.decimal)
    expect(errorsOf(parse({ energy_kcal: '1,2,3' })).energy_kcal).toBe(es.foods.errors.decimal)
  })

  it('un valor negativo se rechaza', () => {
    expect(errorsOf(parse({ fiber_g: '-1' })).fiber_g).toBe(es.foods.errors.negative)
    expect(errorsOf(parse({ energy_kcal: '-5' })).energy_kcal).toBe(es.foods.errors.negative)
  })

  it('los rangos físicos: energía hasta 900, gramos hasta 100, sodio hasta 40.000', () => {
    expect(errorsOf(parse({ energy_kcal: '901' })).energy_kcal).toBe(
      es.foods.errors.outOfRange('900'),
    )
    expect(parse({ energy_kcal: '900' }).success).toBe(true)
    expect(errorsOf(parse({ protein_g: '100,5' })).protein_g).toBe(
      es.foods.errors.outOfRange('100'),
    )
    expect(errorsOf(parse({ sodium_mg: '40001' })).sodium_mg).toBe(
      es.foods.errors.outOfRange('40.000'),
    )
    expect(parse({ sodium_mg: '40000' }).success).toBe(true)
  })

  it('proteínas + carbohidratos + grasas no pueden superar 100 g', () => {
    const errors = errorsOf(parse({ protein_g: '50', carbs_g: '40', fat_g: '20' }))
    expect(errors.protein_g).toBe(es.foods.errors.macrosOver100)
  })

  it('los azúcares no superan los carbohidratos y las saturadas no superan las grasas', () => {
    expect(errorsOf(parse({ carbs_g: '10', sugars_g: '20' })).sugars_g).toBe(
      es.foods.errors.subtotalOverTotal,
    )
    expect(errorsOf(parse({ fat_g: '5', saturated_fat_g: '6' })).saturated_fat_g).toBe(
      es.foods.errors.subtotalOverTotal,
    )
    expect(parse({ carbs_g: '10', sugars_g: '10' }).success).toBe(true)
  })

  it('un subtotal sin su total no se puede comparar y es válido', () => {
    expect(parse({ sugars_g: '20' }).success).toBe(true)
  })

  it('la base solo admite 100 g o 100 ml', () => {
    expect(parse({ reference_basis: '100kg' }).success).toBe(false)
  })
})

describe('foodFormSchema: porciones (FR-007, FR-015)', () => {
  it('acepta porciones con cantidad con coma o punto', () => {
    const result = parse({
      portions: [
        { name: ' Unidad ', quantity: '12,5' },
        { name: 'Paquete', quantity: '120' },
      ],
    })
    expect(result.data?.portions).toEqual([
      { name: 'Unidad', quantity: 12.5 },
      { name: 'Paquete', quantity: 120 },
    ])
  })

  it('el nombre de la porción es obligatorio y la cantidad debe ser mayor que cero', () => {
    const errors = errorsOf(
      parse({
        portions: [
          { name: '', quantity: '10' },
          { name: 'Cero', quantity: '0' },
          { name: 'Texto', quantity: 'mucho' },
          { name: 'Grande', quantity: '5001' },
        ],
      }),
    )
    expect(errors['portions.0.name']).toBe(es.foods.errors.portionName)
    expect(errors['portions.1.quantity']).toBe(es.foods.errors.portionAmount)
    expect(errors['portions.2.quantity']).toBe(es.foods.errors.portionAmount)
    expect(errors['portions.3.quantity']).toBe(es.foods.errors.portionAmount)
  })

  it('no admite dos porciones con el mismo nombre', () => {
    const errors = errorsOf(
      parse({
        portions: [
          { name: 'Taza', quantity: '10' },
          { name: ' taza ', quantity: '20' },
        ],
      }),
    )
    expect(errors['portions.1.name']).toBe(es.foods.errors.portionDuplicate)
  })

  it('admite hasta 20 porciones', () => {
    const portions = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `P${i}`, quantity: '1' }))
    expect(parse({ portions: portions(20) }).success).toBe(true)
    expect(errorsOf(parse({ portions: portions(21) })).portions).toBe(
      es.foods.errors.tooManyPortions,
    )
  })
})
