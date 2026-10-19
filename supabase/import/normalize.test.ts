// T040 (spec 002, FR-014, FR-026, FR-028, FR-029): normalización y validación de lo que se importa.
import { assertAlmostEquals, assertEquals } from '@std/assert'
import {
  applyCap,
  completeness,
  dedupeByCompleteness,
  dedupeUsda,
  kjToKcal,
  type NormalizedFood,
  normalizeName,
  normalizeOffProduct,
  normalizeUsdaFood,
  type OffProduct,
  saltToSodiumMg,
  type TranslationEntry,
  type UsdaFoodInput,
  validateFood,
} from './normalize.ts'

function off(overrides: Partial<OffProduct> = {}): OffProduct {
  return {
    code: '7790895000010',
    product_name: 'Leche entera',
    product_name_es: 'Leche entera larga vida',
    brands: 'La Serenísima, Otra',
    quantity: '1 L',
    nutriments: {
      'energy-kcal_100g': 62,
      proteins_100g: 3,
      carbohydrates_100g: 4.7,
      sugars_100g: 4.7,
      fat_100g: 3.3,
      'saturated-fat_100g': 2.1,
      sodium_100g: 0.045,
    },
    serving_size: '200 ml',
    serving_quantity: 200,
    ...overrides,
  }
}

function food(overrides: Partial<NormalizedFood> = {}): NormalizedFood {
  return {
    source_item_id: 'A',
    name: 'Alimento',
    name_status: 'original',
    brand: null,
    reference_basis: '100g',
    energy_kcal: null,
    protein_g: null,
    carbs_g: null,
    sugars_g: null,
    fat_g: null,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: null,
    portions: [],
    ...overrides,
  }
}

function okFood(product: OffProduct) {
  const result = normalizeOffProduct(product)
  if (!result.ok) {
    throw new Error(`se esperaba un alimento válido, pero se omitió: ${result.reason}`)
  }
  return result.food
}

function skipReason(product: OffProduct) {
  const result = normalizeOffProduct(product)
  return result.ok ? 'ok' : result.reason
}

Deno.test('Open Food Facts: un producto completo se normaliza a la forma de la tabla', () => {
  assertEquals(okFood(off()), {
    source_item_id: '7790895000010',
    name: 'Leche entera larga vida',
    name_status: 'original',
    brand: 'La Serenísima',
    reference_basis: '100ml',
    energy_kcal: 62,
    protein_g: 3,
    carbs_g: 4.7,
    sugars_g: 4.7,
    fat_g: 3.3,
    saturated_fat_g: 2.1,
    fiber_g: null,
    sodium_mg: 45,
    portions: [{ name: 'Porción (200 ml)', quantity: 200 }],
  })
})

Deno.test('FR-029: kJ a kcal solo si falta la energía en kcal', () => {
  assertEquals(kjToKcal(1000), 239)
  const onlyKj = okFood(off({ nutriments: { 'energy-kj_100g': 1000, proteins_100g: 3 } }))
  assertEquals(onlyKj.energy_kcal, 239)
  const genericEnergy = okFood(off({ nutriments: { energy_100g: 1000, proteins_100g: 3 } }))
  assertEquals(genericEnergy.energy_kcal, 239)
  const both = okFood(
    off({ nutriments: { 'energy-kcal_100g': 100, 'energy-kj_100g': 1000, proteins_100g: 3 } }),
  )
  assertEquals(both.energy_kcal, 100)
})

Deno.test('FR-029: el sodio sale de la sal solo si falta el sodio', () => {
  assertEquals(saltToSodiumMg(1), 400)
  const fromSalt = okFood(off({ nutriments: { 'energy-kcal_100g': 10, salt_100g: 1.5 } }))
  assertEquals(fromSalt.sodium_mg, 600)
  const bothPresent = okFood(
    off({ nutriments: { 'energy-kcal_100g': 10, sodium_100g: 0.1, salt_100g: 1.5 } }),
  )
  assertEquals(bothPresent.sodium_mg, 100)
})

Deno.test('FR-028: un dato ausente es null y nunca 0; un cero real se conserva', () => {
  const sparse = okFood(off({ nutriments: { 'energy-kcal_100g': 20 } }))
  assertEquals(sparse.protein_g, null)
  assertEquals(sparse.fiber_g, null)
  assertEquals(sparse.sodium_mg, null)
  const withZero = okFood(off({ nutriments: { 'energy-kcal_100g': 0, sugars_100g: 0 } }))
  assertEquals(withZero.energy_kcal, 0)
  assertEquals(withZero.sugars_g, 0)
  const garbage = okFood(
    off({ nutriments: { 'energy-kcal_100g': 20, proteins_100g: '', fat_100g: 'x' as never } }),
  )
  assertEquals(garbage.protein_g, null)
  assertEquals(garbage.fat_g, null)
})

Deno.test('FR-028: se omiten, con su motivo, los registros imposibles o sin nombre', () => {
  assertEquals(
    skipReason(off({ nutriments: { 'energy-kcal_100g': 10, proteins_100g: -1 } })),
    'negative_value',
  )
  assertEquals(skipReason(off({ nutriments: { 'energy-kcal_100g': 1000 } })), 'out_of_range')
  assertEquals(
    skipReason(off({ nutriments: { 'energy-kcal_100g': 10, sodium_100g: 50 } })),
    'out_of_range',
  )
  assertEquals(
    skipReason(
      off({
        nutriments: {
          'energy-kcal_100g': 10,
          proteins_100g: 60,
          carbohydrates_100g: 30,
          fat_100g: 20,
        },
      }),
    ),
    'macros_exceed_100',
  )
  assertEquals(
    skipReason(off({ product_name: '  ', product_name_es: '', generic_name: '' })),
    'no_name',
  )
  assertEquals(skipReason(off({ nutriments: {} })), 'no_nutrients')
  assertEquals(skipReason(off({ nutriments: undefined })), 'no_nutrients')
  assertEquals(skipReason(off({ code: '' })), 'no_code')
})

Deno.test('los subtotales con una diferencia de redondeo se ajustan; los imposibles se omiten', () => {
  const rounded = okFood(
    off({
      nutriments: {
        'energy-kcal_100g': 40,
        carbohydrates_100g: 10,
        sugars_100g: 10.3,
        fat_100g: 5,
        'saturated-fat_100g': 5.2,
      },
    }),
  )
  assertEquals(rounded.sugars_g, 10)
  assertEquals(rounded.saturated_fat_g, 5)
  assertEquals(
    skipReason(
      off({ nutriments: { 'energy-kcal_100g': 40, carbohydrates_100g: 10, sugars_100g: 12 } }),
    ),
    'sugars_exceed_carbs',
  )
  assertEquals(
    skipReason(
      off({ nutriments: { 'energy-kcal_100g': 40, fat_100g: 5, 'saturated-fat_100g': 8 } }),
    ),
    'saturated_exceeds_fat',
  )
})

Deno.test('el nombre en español gana; si no, el principal; luego el genérico; se recorta', () => {
  assertEquals(okFood(off()).name, 'Leche entera larga vida')
  assertEquals(okFood(off({ product_name_es: '' })).name, 'Leche entera')
  assertEquals(
    okFood(off({ product_name_es: '', product_name: '', generic_name: 'Lácteo' })).name,
    'Lácteo',
  )
  assertEquals(
    okFood(off({ product_name_es: '  Leche   con   espacios  ' })).name,
    'Leche con espacios',
  )
  assertEquals(okFood(off({ product_name_es: 'x'.repeat(250) })).name.length, 200)
})

Deno.test('la marca es la primera de la lista; vacía es null', () => {
  assertEquals(okFood(off()).brand, 'La Serenísima')
  assertEquals(okFood(off({ brands: '' })).brand, null)
  assertEquals(okFood(off({ brands: undefined })).brand, null)
  assertEquals(okFood(off({ brands: 'y'.repeat(150) })).brand?.length, 120)
})

Deno.test('la base es 100 ml para los líquidos y 100 g para el resto', () => {
  assertEquals(okFood(off({ quantity: '500 ml' })).reference_basis, '100ml')
  assertEquals(okFood(off({ quantity: '1,5 L' })).reference_basis, '100ml')
  assertEquals(okFood(off({ quantity: '330 cl' })).reference_basis, '100ml')
  assertEquals(okFood(off({ quantity: '250 g' })).reference_basis, '100g')
  assertEquals(okFood(off({ quantity: undefined })).reference_basis, '100g')
})

Deno.test('FR-029: la porción sale de la porción informada y se guarda aparte', () => {
  assertEquals(okFood(off({ serving_size: '30 g', serving_quantity: 30 })).portions, [
    { name: 'Porción (30 g)', quantity: 30 },
  ])
  assertEquals(okFood(off({ serving_quantity: 0 })).portions, [])
  assertEquals(okFood(off({ serving_quantity: 9000 })).portions, [])
  assertEquals(okFood(off({ serving_size: undefined, serving_quantity: undefined })).portions, [])
  assertEquals(okFood(off({ serving_quantity: '45' as never, serving_size: '45 g' })).portions, [
    { name: 'Porción (45 g)', quantity: 45 },
  ])
})

Deno.test('validateFood también rechaza lo que llega ya normalizado pero es imposible', () => {
  assertEquals(validateFood(food({ energy_kcal: 100 })).ok, true)
  assertEquals(validateFood(food({ energy_kcal: -5 })), {
    ok: false,
    reason: 'negative_value',
    source_item_id: 'A',
  })
  assertEquals(validateFood(food({ name: '' })).ok, false)
  assertEquals(validateFood(food()).ok, false)
})

Deno.test('completeness cuenta los nutrientes informados', () => {
  assertEquals(completeness(food()), 0)
  assertEquals(completeness(food({ energy_kcal: 1, protein_g: 0, sodium_mg: 3 })), 3)
})

Deno.test('FR-026: un duplicado dentro de la fuente conserva el más completo', () => {
  const sparse = food({ source_item_id: '1', name: 'Corto', energy_kcal: 10 })
  const complete = food({ source_item_id: '1', name: 'Completo', energy_kcal: 10, protein_g: 1 })
  const other = food({ source_item_id: '2', name: 'Otro', energy_kcal: 10 })
  const result = dedupeByCompleteness([sparse, other, complete])
  assertEquals(result.duplicates, 1)
  assertEquals(result.foods.map((f) => f.name), ['Completo', 'Otro'])
  // a igual completitud gana el primero
  const tie = dedupeByCompleteness([
    food({ source_item_id: '9', name: 'Primero' }),
    food({ source_item_id: '9', name: 'Segundo' }),
  ])
  assertEquals(tie.foods.map((f) => f.name), ['Primero'])
})

Deno.test('el tope de volumen prioriza los más completos y conserva el orden entre iguales', () => {
  const items = [
    food({ source_item_id: 'a', energy_kcal: 1 }),
    food({ source_item_id: 'b', energy_kcal: 1, protein_g: 1, fat_g: 1 }),
    food({ source_item_id: 'c', energy_kcal: 1, protein_g: 1 }),
    food({ source_item_id: 'd', energy_kcal: 1 }),
  ]
  assertEquals(applyCap(items, 3).map((f) => f.source_item_id), ['b', 'c', 'a'])
  assertEquals(applyCap(items, 10).length, 4)
  assertEquals(applyCap(items, 0).length, 0)
})

// ---- USDA --------------------------------------------------------------------------------------

function usda(overrides: Partial<UsdaFoodInput> = {}): UsdaFoodInput {
  return {
    fdc_id: '170393',
    description: 'Rice, white, cooked',
    data_type: 'sr_legacy_food',
    nutrients: new Map([
      [1008, 130],
      [1003, 2.7],
      [1005, 28.2],
      [2000, 0.1],
      [1004, 0.3],
      [1258, 0.1],
      [1079, 0.4],
      [1093, 1],
    ]),
    portions: [{ amount: 1, unit: 'cup', gram_weight: 158 }],
    ...overrides,
  }
}

const translations = new Map<string, TranslationEntry>([
  ['170393', { nombre_es: 'Arroz blanco cocido', estado: 'machine_translated' }],
  ['999', { nombre_es: 'Manzana con piel', estado: 'reviewed' }],
])

Deno.test('USDA: mapea los nutrientes por su identificador y usa el nombre traducido', () => {
  const result = normalizeUsdaFood(usda(), translations)
  if (!result.ok) throw new Error(result.reason)
  assertEquals(result.food, {
    source_item_id: '170393',
    name: 'Arroz blanco cocido',
    name_status: 'machine_translated',
    brand: null,
    reference_basis: '100g',
    energy_kcal: 130,
    protein_g: 2.7,
    carbs_g: 28.2,
    sugars_g: 0.1,
    fat_g: 0.3,
    saturated_fat_g: 0.1,
    fiber_g: 0.4,
    sodium_mg: 1,
    portions: [{ name: '1 taza', quantity: 158 }],
  })
})

Deno.test('USDA: el estado del nombre sale de la tabla de traducciones', () => {
  const reviewed = normalizeUsdaFood(usda({ fdc_id: '999' }), translations)
  if (!reviewed.ok) throw new Error(reviewed.reason)
  assertEquals(reviewed.food.name_status, 'reviewed')
  assertEquals(reviewed.food.name, 'Manzana con piel')
})

Deno.test('USDA: sin entrada en la tabla de traducciones se omite (no_translation)', () => {
  const result = normalizeUsdaFood(usda({ fdc_id: '1' }), translations)
  assertEquals(result.ok, false)
  assertEquals(result.ok ? '' : result.reason, 'no_translation')
})

Deno.test('USDA: energía desde kJ o desde el factor general de Atwater si falta la de kcal', () => {
  const kj = normalizeUsdaFood(
    usda({ nutrients: new Map([[1062, 418.4], [1003, 1]]) }),
    translations,
  )
  if (!kj.ok) throw new Error(kj.reason)
  assertAlmostEquals(kj.food.energy_kcal ?? 0, 100, 0.1)
  const atwater = normalizeUsdaFood(
    usda({ nutrients: new Map([[2047, 77], [1003, 1]]) }),
    translations,
  )
  if (!atwater.ok) throw new Error(atwater.reason)
  assertEquals(atwater.food.energy_kcal, 77)
})

Deno.test('USDA: un nutriente ausente es null y un registro sin ninguno se omite', () => {
  const partial = normalizeUsdaFood(usda({ nutrients: new Map([[1008, 50]]) }), translations)
  if (!partial.ok) throw new Error(partial.reason)
  assertEquals(partial.food.protein_g, null)
  const none = normalizeUsdaFood(usda({ nutrients: new Map() }), translations)
  assertEquals(none.ok ? '' : none.reason, 'no_nutrients')
})

Deno.test('USDA: las porciones usan unidades conocidas en español y omiten las demás', () => {
  const result = normalizeUsdaFood(
    usda({
      portions: [
        { amount: 1, unit: 'cup', gram_weight: 158 },
        { amount: 2, unit: 'tablespoon', gram_weight: 30 },
        { amount: 1, unit: 'undetermined', gram_weight: 50 },
        { amount: 0.5, unit: 'slice', gram_weight: 20 },
        { amount: 1, unit: 'cup', gram_weight: 160 },
        { amount: 1, unit: 'cup', gram_weight: 0 },
      ],
    }),
    translations,
  )
  if (!result.ok) throw new Error(result.reason)
  assertEquals(result.food.portions, [
    { name: '1 taza', quantity: 158 },
    { name: '2 cucharadas', quantity: 30 },
    { name: '0,5 rodaja', quantity: 20 },
  ])
})

Deno.test('USDA: entre Foundation Foods y SR Legacy con el mismo nombre normalizado gana Foundation Foods', () => {
  assertEquals(normalizeName('  Árroz   BLANCO  '), 'arroz blanco')
  const foundation = food({ source_item_id: 'F1', name: 'Arroz blanco' })
  const legacy = food({ source_item_id: 'S1', name: 'ARROZ blanco' })
  const legacyOnly = food({ source_item_id: 'S2', name: 'Lenteja' })
  const result = dedupeUsda([
    { food: legacy, data_type: 'sr_legacy_food' },
    { food: foundation, data_type: 'foundation_food' },
    { food: legacyOnly, data_type: 'sr_legacy_food' },
  ])
  assertEquals(result.duplicates, 1)
  assertEquals(result.foods.map((f) => f.source_item_id).sort(), ['F1', 'S2'])
})

// ---- T074: endurecimiento frente a datos externos malformados ------------------------------------------

Deno.test('T074: los caracteres de control se eliminan de nombres y marcas (un NUL haría fallar todo el lote)', () => {
  const result = normalizeOffProduct(
    off({ product_name_es: 'Leche\u0000 entera\u0007\u001b[31m roja', brands: 'Mar\u0000ca' }),
  )
  if (!result.ok) throw new Error(result.reason)
  assertEquals(result.food.name, 'Leche entera[31m roja')
  assertEquals(result.food.brand, 'Marca')
  // lo que queda sin texto visible se trata como sin nombre
  assertEquals(
    skipReason(off({ product_name_es: '\u0000\u0001', product_name: '', generic_name: '' })),
    'no_name',
  )
})

Deno.test('T074: un código de origen con caracteres raros o demasiado largo se rechaza', () => {
  assertEquals(skipReason(off({ code: '7790895000010' })), 'ok')
  assertEquals(skipReason(off({ code: "1'; drop table foods; --" })), 'no_code')
  assertEquals(skipReason(off({ code: '1'.repeat(65) })), 'no_code')
  assertEquals(skipReason(off({ code: 'ABC-123_x.y' })), 'ok')
})

Deno.test('T074: valores numéricos extraños (texto, infinitos, notación) no pasan como datos', () => {
  const weird = okFood(
    off({
      nutriments: {
        'energy-kcal_100g': 50,
        proteins_100g: Infinity,
        carbohydrates_100g: 'NaN' as never,
        fat_100g: {} as never,
        fiber_100g: [] as never,
      },
    }),
  )
  assertEquals(weird.protein_g, null)
  assertEquals(weird.carbs_g, null)
  assertEquals(weird.fat_g, null)
  assertEquals(weird.fiber_g, null)
})
