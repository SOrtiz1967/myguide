// Funciones puras de nutrición (Principio VII: separadas de la presentación y de la IA).
// Reglas de dominio: skill `nutrition-domain-rules`. Un valor que falta es `null`, nunca 0.

export type Unit = 'kcal' | 'g' | 'mg'
export type ReferenceBasis = '100g' | '100ml'

export type NutrientKey =
  | 'energy_kcal'
  | 'protein_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sodium_mg'

export interface NutrientDef {
  key: NutrientKey
  label: string
  unit: Unit
  /** Subtotal de la fila anterior ("de los cuales azúcares"). */
  indent?: boolean
}

/** Los nutrientes de la spec 002, en el orden en que se muestran. */
export const NUTRIENTS: readonly NutrientDef[] = [
  { key: 'energy_kcal', label: 'Energía', unit: 'kcal' },
  { key: 'protein_g', label: 'Proteínas', unit: 'g' },
  { key: 'carbs_g', label: 'Carbohidratos', unit: 'g' },
  { key: 'sugars_g', label: 'de los cuales azúcares', unit: 'g', indent: true },
  { key: 'fat_g', label: 'Grasas totales', unit: 'g' },
  { key: 'saturated_fat_g', label: 'de las cuales saturadas', unit: 'g', indent: true },
  { key: 'fiber_g', label: 'Fibra', unit: 'g' },
  { key: 'sodium_mg', label: 'Sodio', unit: 'mg' },
]

const MISSING = 'sin dato'

const formatters: Record<Unit, Intl.NumberFormat> = {
  // La energía no se muestra con decimales: no hay precisión que justifique más.
  kcal: new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0, useGrouping: true }),
  g: new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1, useGrouping: true }),
  mg: new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1, useGrouping: true }),
}

/** "62 kcal", "3,3 g", "45 mg" o "sin dato" (FR-005, FR-006). */
export function formatValue(value: number | null | undefined, unit: Unit): string {
  if (value === null || value === undefined) return MISSING
  return `${formatters[unit].format(value)} ${unit}`
}

export function basisLabel(basis: ReferenceBasis): string {
  return basis === '100g' ? 'por 100 g' : 'por 100 ml'
}

export type ParsedDecimal = { valid: true; value: number | null } | { valid: false }

const DECIMAL = /^-?\d+([.,]\d+)?$/

/** Interpreta texto con coma o punto decimal (FR-019). Vacío es "sin dato" (`null`). */
export function parseDecimal(input: string): ParsedDecimal {
  const text = input.trim()
  if (text === '') return { valid: true, value: null }
  if (!DECIMAL.test(text)) return { valid: false }
  return { valid: true, value: Number(text.replace(',', '.')) }
}

export interface MacroInput {
  energy: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

export interface EnergyCoherence {
  coherent: boolean
  /** kcal que resultarían de 4·P + 4·C + 9·G; `null` si faltan datos. */
  expected: number | null
  /** energía declarada − esperada; `null` si faltan datos. */
  difference: number | null
}

const MIN_DIFFERENCE_KCAL = 30
const MIN_DIFFERENCE_RATIO = 0.25

/**
 * Compara la energía declarada con la que resultaría de los macronutrientes (FR-018).
 * Solo opina con los cuatro datos; avisa si la diferencia supera 30 kcal Y el 25 % de lo esperado.
 * Es informativo: nunca impide guardar.
 */
export function energyCoherence({ energy, protein, carbs, fat }: MacroInput): EnergyCoherence {
  if (protein === null || carbs === null || fat === null) {
    return { coherent: true, expected: null, difference: null }
  }
  const expected = 4 * protein + 4 * carbs + 9 * fat
  if (energy === null) return { coherent: true, expected, difference: null }

  const difference = energy - expected
  const gap = Math.abs(difference)
  const coherent = gap <= MIN_DIFFERENCE_KCAL || gap <= MIN_DIFFERENCE_RATIO * expected
  return { coherent, expected, difference }
}
