// Spec 009 (FR-002, FR-011): forma y validación estricta de lo que devuelve la IA. El proveedor recibe
// un esquema que guía su salida, pero esta validación no confía en él: lo que no cumpla se descarta
// entero y se trata como fallo del proveedor (Principio VII).

export const MAX_ITEMS = 12
export const MAX_NAME = 200
export const MAX_QUANTITY_TEXT = 60
export const MAX_ENERGY_KCAL = 5000
export const MAX_MACRO_G = 1000

export interface EstimatedItem {
  name: string
  quantity_text: string | null
  energy_kcal: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

export class InvalidEstimateError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'InvalidEstimateError'
  }
}

/** Esquema que se le pide al proveedor (subconjunto de OpenAPI que Gemini admite). */
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity_text: { type: 'STRING', nullable: true },
          energy_kcal: { type: 'NUMBER' },
          protein_g: { type: 'NUMBER', nullable: true },
          carbs_g: { type: 'NUMBER', nullable: true },
          fat_g: { type: 'NUMBER', nullable: true },
        },
        required: ['name', 'energy_kcal'],
      },
    },
  },
  required: ['items'],
} as const

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const round1 = (value: number) => Math.round(value * 10) / 10

function number(value: unknown, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new InvalidEstimateError(`out_of_range:${field}`)
  }
  return round1(value)
}

function optionalNumber(value: unknown, max: number, field: string): number | null {
  return value === null || value === undefined ? null : number(value, max, field)
}

/**
 * Valida la respuesta del proveedor (ya convertida de JSON) y devuelve los ítems normalizados.
 * Lanza `InvalidEstimateError` si algo no cumple; una lista vacía es válida (la IA no encontró alimentos).
 */
export function parseEstimate(raw: unknown): EstimatedItem[] {
  if (!isObject(raw) || !Array.isArray(raw.items)) throw new InvalidEstimateError('shape')
  if (raw.items.length > MAX_ITEMS) throw new InvalidEstimateError('too_many_items')

  return raw.items.map((entry, index): EstimatedItem => {
    if (!isObject(entry)) throw new InvalidEstimateError(`shape:${index}`)
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (name === '' || name.length > MAX_NAME) throw new InvalidEstimateError(`name:${index}`)

    let quantityText: string | null = null
    if (entry.quantity_text !== null && entry.quantity_text !== undefined) {
      if (typeof entry.quantity_text !== 'string') {
        throw new InvalidEstimateError(`quantity_text:${index}`)
      }
      const trimmed = entry.quantity_text.trim()
      if (trimmed.length > MAX_QUANTITY_TEXT) {
        throw new InvalidEstimateError(`quantity_text:${index}`)
      }
      quantityText = trimmed === '' ? null : trimmed
    }

    return {
      name,
      quantity_text: quantityText,
      energy_kcal: number(entry.energy_kcal, MAX_ENERGY_KCAL, 'energy_kcal'),
      protein_g: optionalNumber(entry.protein_g, MAX_MACRO_G, 'protein_g'),
      carbs_g: optionalNumber(entry.carbs_g, MAX_MACRO_G, 'carbs_g'),
      fat_g: optionalNumber(entry.fat_g, MAX_MACRO_G, 'fat_g'),
    }
  })
}

/** Convierte el texto que devolvió el modelo en JSON y lo valida. */
export function parseEstimateText(text: string): EstimatedItem[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new InvalidEstimateError('not_json')
  }
  return parseEstimate(raw)
}
