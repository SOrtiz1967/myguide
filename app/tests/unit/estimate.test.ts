// Spec 009 (FR-002, FR-006, FR-012, FR-017): conversiones y mensajes de la estimación con IA.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { EstimateError, type EstimatedItem } from '../../src/features/meals/ai/api'
import {
  estimateErrorMessage,
  itemToForm,
  mergeItems,
  totalEnergyText,
} from '../../src/features/meals/ai/estimate'

const item = (over: Partial<EstimatedItem> = {}): EstimatedItem => ({
  name: 'Milanesa al horno',
  quantity_text: '2 unidades',
  energy_kcal: 520,
  protein_g: 44.5,
  carbs_g: 30,
  fat_g: 24,
  ...over,
})

describe('itemToForm', () => {
  it('pasa el ítem a texto de formulario con coma decimal y deja vacío lo que no propone', () => {
    expect(itemToForm(item())).toEqual({
      description: 'Milanesa al horno',
      quantity_text: '2 unidades',
      energy_kcal: '520',
      protein_g: '44,5',
      carbs_g: '30',
      sugars_g: '',
      fat_g: '24',
      saturated_fat_g: '',
      fiber_g: '',
      sodium_mg: '',
    })
  })

  it('un dato ausente queda vacío, no cero', () => {
    const form = itemToForm(
      item({ quantity_text: null, protein_g: null, carbs_g: null, fat_g: null }),
    )
    expect(form).toMatchObject({ quantity_text: '', protein_g: '', carbs_g: '', fat_g: '' })
  })
})

describe('mergeItems', () => {
  it('sin ítems no hay nada que juntar', () => {
    expect(mergeItems([])).toBeNull()
  })

  it('suma la energía y los macros, y deja vacío el macro que ningún ítem trae', () => {
    const merged = mergeItems([
      item({ energy_kcal: 100, protein_g: 10, carbs_g: null, fat_g: null }),
      item({ name: 'Otro', energy_kcal: 50.5, protein_g: 2.25, carbs_g: null, fat_g: 3 }),
    ])
    expect(merged).toEqual({
      name: 'Milanesa al horno',
      quantity_text: '2 unidades',
      energy_kcal: 150.5,
      protein_g: 12.3,
      carbs_g: null,
      fat_g: 3,
    })
  })
})

describe('estimateErrorMessage', () => {
  it('cada código del contrato tiene su mensaje, siempre con el camino manual a la vista', () => {
    for (const code of [
      'no_items',
      'rate_limited',
      'daily_limit',
      'quota_exhausted',
      'ai_unavailable',
      'ai_timeout',
      'ai_failed',
      'ai_invalid',
    ] as const) {
      expect(estimateErrorMessage(new EstimateError(code))).toBe(es.meals.ai.errors[code])
    }
    expect(estimateErrorMessage(new EstimateError('rate_limited'))).toMatch(/a mano/)
  })

  it('sin conexión, sesión vencida o error desconocido', () => {
    expect(estimateErrorMessage(new EstimateError('offline'))).toBe(es.meals.ai.errors.offline)
    expect(estimateErrorMessage(new TypeError('Failed to fetch'))).toBe(es.meals.ai.errors.offline)
    expect(estimateErrorMessage(new EstimateError('http_401'))).toBe(
      es.meals.ai.errors.unauthorized,
    )
    expect(estimateErrorMessage(new EstimateError('algo_raro'))).toBe(es.meals.ai.errors.generic)
    expect(estimateErrorMessage('x')).toBe(es.meals.ai.errors.generic)
  })

  it('los mensajes no culpan ni juzgan', () => {
    const all = JSON.stringify(es.meals.ai)
    expect(all).not.toMatch(/\b(bueno|malo|deber[ií]as|culpa|fallaste|olvidaste)\b/i)
  })
})

describe('totalEnergyText', () => {
  it('suma solo los valores presentes y los formatea', () => {
    expect(totalEnergyText([520, null, 1180])).toBe('1.700')
    expect(totalEnergyText([])).toBe('0')
  })
})
