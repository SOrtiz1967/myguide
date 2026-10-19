// T045 (spec 002): normalización y validación puras del catálogo (contracts/import-pipeline.md).
// Todo lo que entra a la base pasa por aquí. Un dato ausente es `null`, nunca 0 (FR-028).

export type NameStatus = 'original' | 'machine_translated' | 'reviewed'
export type ReferenceBasis = '100g' | '100ml'

export interface Portion {
  name: string
  quantity: number
}

/** Un alimento listo para `import_foods`: los nombres de campos son los de la tabla `foods`. */
export interface NormalizedFood {
  source_item_id: string
  name: string
  name_status: NameStatus
  brand: string | null
  reference_basis: ReferenceBasis
  energy_kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  sugars_g: number | null
  fat_g: number | null
  saturated_fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  portions: Portion[]
}

export type SkipReason =
  | 'no_code'
  | 'no_name'
  | 'no_nutrients'
  | 'negative_value'
  | 'out_of_range'
  | 'macros_exceed_100'
  | 'sugars_exceed_carbs'
  | 'saturated_exceeds_fat'
  | 'no_translation'

export type Result =
  | { ok: true; food: NormalizedFood }
  | { ok: false; reason: SkipReason; source_item_id: string }

export const KJ_PER_KCAL = 4.184
/** 1 g de sal contiene unos 400 mg de sodio (sal / 2,5 × 1000). */
export const SODIUM_MG_PER_SALT_G = 400

const NAME_MAX = 200
const BRAND_MAX = 120
const PORTION_NAME_MAX = 80
const PORTION_MAX_QUANTITY = 5000
const MAX_PORTIONS = 20
/** Diferencia de redondeo tolerada entre un subtotal y su total (azúcares y saturadas), en gramos. */
const SUBTOTAL_TOLERANCE_G = 0.5

type NutrientField =
  | 'energy_kcal'
  | 'protein_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sodium_mg'

const NUTRIENT_FIELDS: NutrientField[] = [
  'energy_kcal',
  'protein_g',
  'carbs_g',
  'sugars_g',
  'fat_g',
  'saturated_fat_g',
  'fiber_g',
  'sodium_mg',
]

const MAX_BY_FIELD: Record<NutrientField, number> = {
  energy_kcal: 900,
  protein_g: 100,
  carbs_g: 100,
  sugars_g: 100,
  fat_g: 100,
  saturated_fat_g: 100,
  fiber_g: 100,
  sodium_mg: 40000,
}

// ---- utilidades ------------------------------------------------------------------------------------

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Un número finito o `null`: lo vacío, el texto no numérico y lo infinito son "sin dato". */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim().replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// Los caracteres de control (NUL, BEL, ESC...) se eliminan: un NUL en un solo nombre haría fallar el
// lote completo en la base de datos, y ninguno tiene sentido en el nombre de un alimento.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').replace(CONTROL_CHARACTERS, '').trim() : ''

/** Los códigos de origen son identificadores: letras, números y . _ - hasta 64 caracteres. */
const SOURCE_ITEM_ID = /^[A-Za-z0-9._-]{1,64}$/

const truncate = (
  value: string,
  max: number,
) => (value.length > max ? value.slice(0, max).trim() : value)

export function kjToKcal(kj: number): number {
  return round(kj / KJ_PER_KCAL, 1)
}

export function saltToSodiumMg(saltGrams: number): number {
  return round(saltGrams * SODIUM_MG_PER_SALT_G, 2)
}

/** Minúsculas, sin acentos y con espacios simples: para comparar nombres. */
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function completeness(food: NormalizedFood): number {
  return NUTRIENT_FIELDS.filter((field) => food[field] !== null).length
}

/** Ajusta un subtotal que supera a su total solo por redondeo (hasta 0,5 g); si no, lo deja para que se omita. */
function reconcileSubtotal(subtotal: number | null, total: number | null): number | null {
  if (
    subtotal !== null && total !== null && subtotal > total &&
    subtotal - total <= SUBTOTAL_TOLERANCE_G
  ) {
    return total
  }
  return subtotal
}

// ---- validación ------------------------------------------------------------------------------------

export function validateFood(food: NormalizedFood): Result {
  const fail = (reason: SkipReason): Result => ({
    ok: false,
    reason,
    source_item_id: food.source_item_id,
  })

  if (!SOURCE_ITEM_ID.test(food.source_item_id)) return fail('no_code')
  if (food.name.trim() === '' || food.name.length > NAME_MAX) return fail('no_name')

  let informed = 0
  for (const field of NUTRIENT_FIELDS) {
    const value = food[field]
    if (value === null) continue
    informed++
    if (value < 0) return fail('negative_value')
    if (value > MAX_BY_FIELD[field]) return fail('out_of_range')
  }
  if (informed === 0) return fail('no_nutrients')

  if ((food.protein_g ?? 0) + (food.carbs_g ?? 0) + (food.fat_g ?? 0) > 100) {
    return fail('macros_exceed_100')
  }
  if (food.sugars_g !== null && food.carbs_g !== null && food.sugars_g > food.carbs_g) {
    return fail('sugars_exceed_carbs')
  }
  if (food.saturated_fat_g !== null && food.fat_g !== null && food.saturated_fat_g > food.fat_g) {
    return fail('saturated_exceeds_fat')
  }
  return { ok: true, food }
}

// ---- Open Food Facts -------------------------------------------------------------------------------

export interface OffProduct {
  code?: string
  product_name?: string
  product_name_es?: string
  generic_name?: string
  brands?: string
  quantity?: string
  nutriments?: Record<string, unknown>
  serving_size?: string
  serving_quantity?: number | string
}

const LIQUID_QUANTITY = /\b\d+([.,]\d+)?\s*(ml|cl|dl|lts?|l|litros?)\b/i

export function normalizeOffProduct(product: OffProduct): Result {
  const code = clean(product.code)
  const n = product.nutriments ?? {}

  const kcal = toNumber(n['energy-kcal_100g'])
  const kj = toNumber(n['energy-kj_100g']) ?? toNumber(n['energy_100g'])
  const sodiumGrams = toNumber(n['sodium_100g'])
  const saltGrams = toNumber(n['salt_100g'])

  const carbs = toNumber(n['carbohydrates_100g'])
  const fat = toNumber(n['fat_100g'])

  const name = truncate(
    clean(product.product_name_es) || clean(product.product_name) || clean(product.generic_name),
    NAME_MAX,
  )
  const brand = truncate(clean(product.brands?.split(',')[0]), BRAND_MAX)

  const servingQuantity = toNumber(product.serving_quantity)
  const servingSize = clean(product.serving_size)
  const portions: Portion[] =
    servingQuantity !== null && servingQuantity > 0 && servingQuantity <= PORTION_MAX_QUANTITY
      ? [
        {
          name: servingSize !== '' && servingSize.length <= PORTION_NAME_MAX - 10
            ? `Porción (${servingSize})`
            : 'Porción',
          quantity: servingQuantity,
        },
      ]
      : []

  const food: NormalizedFood = {
    source_item_id: code,
    name,
    name_status: 'original',
    brand: brand === '' ? null : brand,
    reference_basis: LIQUID_QUANTITY.test(product.quantity ?? '') ? '100ml' : '100g',
    energy_kcal: kcal ?? (kj !== null ? kjToKcal(kj) : null),
    protein_g: toNumber(n['proteins_100g']),
    carbs_g: carbs,
    sugars_g: reconcileSubtotal(toNumber(n['sugars_100g']), carbs),
    fat_g: fat,
    saturated_fat_g: reconcileSubtotal(toNumber(n['saturated-fat_100g']), fat),
    fiber_g: toNumber(n['fiber_100g']),
    sodium_mg: sodiumGrams !== null
      ? round(sodiumGrams * 1000, 2)
      : saltGrams !== null
      ? saltToSodiumMg(saltGrams)
      : null,
    portions,
  }
  return validateFood(food)
}

// ---- USDA FoodData Central ------------------------------------------------------------------------

export type UsdaDataType = 'foundation_food' | 'sr_legacy_food'

export interface UsdaPortion {
  amount: number
  unit: string
  gram_weight: number
}

export interface UsdaFoodInput {
  fdc_id: string
  description: string
  data_type: UsdaDataType
  /** Cantidad por 100 g de cada nutriente, por su `nutrient_id` de FoodData Central. */
  nutrients: Map<number, number>
  portions: UsdaPortion[]
}

export interface TranslationEntry {
  nombre_es: string
  estado: 'machine_translated' | 'reviewed'
}

/** Identificadores de nutrientes de FoodData Central, en orden de preferencia. */
const USDA_IDS = {
  energy_kcal: [1008, 2047, 2048],
  energy_kj: [1062],
  protein_g: [1003],
  carbs_g: [1005],
  sugars_g: [2000, 1063],
  fat_g: [1004],
  saturated_fat_g: [1258],
  fiber_g: [1079],
  sodium_mg: [1093],
} as const

function usdaValue(nutrients: Map<number, number>, ids: readonly number[]): number | null {
  for (const id of ids) {
    const value = toNumber(nutrients.get(id))
    if (value !== null) return value
  }
  return null
}

/** Unidades de medida de USDA que se muestran en español; las demás no se importan. */
const USDA_UNITS: Record<string, [singular: string, plural: string]> = {
  cup: ['taza', 'tazas'],
  tablespoon: ['cucharada', 'cucharadas'],
  teaspoon: ['cucharadita', 'cucharaditas'],
  slice: ['rodaja', 'rodajas'],
  piece: ['trozo', 'trozos'],
  oz: ['onza', 'onzas'],
}

const formatAmount = (amount: number) => String(round(amount, 2)).replace('.', ',')

function usdaPortions(portions: UsdaPortion[]): Portion[] {
  const result: Portion[] = []
  const seen = new Set<string>()
  for (const portion of portions) {
    const unit = USDA_UNITS[portion.unit.trim().toLowerCase()]
    const grams = toNumber(portion.gram_weight)
    const amount = toNumber(portion.amount)
    if (!unit || grams === null || amount === null || amount <= 0) continue
    if (grams <= 0 || grams > PORTION_MAX_QUANTITY) continue
    const name = `${formatAmount(amount)} ${amount > 1 ? unit[1] : unit[0]}`
    if (seen.has(name) || name.length > PORTION_NAME_MAX) continue
    seen.add(name)
    result.push({ name, quantity: round(grams, 2) })
    if (result.length >= MAX_PORTIONS) break
  }
  return result
}

export function normalizeUsdaFood(
  input: UsdaFoodInput,
  translations: Map<string, TranslationEntry>,
): Result {
  const entry = translations.get(input.fdc_id)
  if (!entry || clean(entry.nombre_es) === '') {
    return { ok: false, reason: 'no_translation', source_item_id: input.fdc_id }
  }
  const n = input.nutrients
  const kcal = usdaValue(n, USDA_IDS.energy_kcal)
  const kj = usdaValue(n, USDA_IDS.energy_kj)
  const carbs = usdaValue(n, USDA_IDS.carbs_g)
  const fat = usdaValue(n, USDA_IDS.fat_g)

  const round2 = (value: number | null) => (value === null ? null : round(value, 2))
  const food: NormalizedFood = {
    source_item_id: input.fdc_id,
    name: truncate(clean(entry.nombre_es), NAME_MAX),
    name_status: entry.estado,
    brand: null,
    reference_basis: '100g',
    energy_kcal: kcal !== null ? round2(kcal) : kj !== null ? kjToKcal(kj) : null,
    protein_g: round2(usdaValue(n, USDA_IDS.protein_g)),
    carbs_g: round2(carbs),
    sugars_g: round2(reconcileSubtotal(usdaValue(n, USDA_IDS.sugars_g), carbs)),
    fat_g: round2(fat),
    saturated_fat_g: round2(reconcileSubtotal(usdaValue(n, USDA_IDS.saturated_fat_g), fat)),
    fiber_g: round2(usdaValue(n, USDA_IDS.fiber_g)),
    sodium_mg: round2(usdaValue(n, USDA_IDS.sodium_mg)),
    portions: usdaPortions(input.portions),
  }
  return validateFood(food)
}

// ---- duplicados y tope de volumen ----------------------------------------------------------------

/** Dentro de una misma fuente, conserva el más completo de los que comparten identificador (FR-026). */
export function dedupeByCompleteness(foods: NormalizedFood[]): {
  foods: NormalizedFood[]
  duplicates: number
} {
  const byId = new Map<string, NormalizedFood>()
  let duplicates = 0
  for (const food of foods) {
    const current = byId.get(food.source_item_id)
    if (!current) {
      byId.set(food.source_item_id, food)
      continue
    }
    duplicates++
    if (completeness(food) > completeness(current)) byId.set(food.source_item_id, food)
  }
  return { foods: [...byId.values()], duplicates }
}

/** Entre Foundation Foods y SR Legacy con el mismo nombre normalizado gana Foundation Foods. */
export function dedupeUsda(items: { food: NormalizedFood; data_type: UsdaDataType }[]): {
  foods: NormalizedFood[]
  duplicates: number
} {
  const byName = new Map<string, { food: NormalizedFood; data_type: UsdaDataType }>()
  let duplicates = 0
  for (const item of items) {
    const key = normalizeName(item.food.name)
    const current = byName.get(key)
    if (!current) {
      byName.set(key, item)
      continue
    }
    duplicates++
    if (current.data_type !== 'foundation_food' && item.data_type === 'foundation_food') {
      byName.set(key, item)
    }
  }
  return { foods: [...byName.values()].map((item) => item.food), duplicates }
}

/** Corta en el tope de volumen priorizando los más completos; entre iguales conserva el orden. */
export function applyCap(foods: NormalizedFood[], limit: number): NormalizedFood[] {
  if (limit <= 0) return []
  return foods
    .map((food, index) => ({ food, index }))
    .sort((a, b) => completeness(b.food) - completeness(a.food) || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.food)
}
