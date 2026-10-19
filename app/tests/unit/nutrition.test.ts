// T015 (spec 002, FR-005, FR-006, FR-018, FR-019): valores nutricionales, unidades y faltantes.
import { describe, expect, it } from 'vitest'
import {
  NUTRIENTS,
  basisLabel,
  energyCoherence,
  formatAmount,
  formatValue,
  parseDecimal,
} from '../../src/features/foods/nutrition'

describe('formatValue', () => {
  it('FR-005: muestra el valor con su unidad y el formato regional', () => {
    expect(formatValue(62, 'kcal')).toBe('62 kcal')
    expect(formatValue(3.3, 'g')).toBe('3,3 g')
    expect(formatValue(45, 'mg')).toBe('45 mg')
  })

  it('FR-006: un valor que falta es "sin dato", nunca 0', () => {
    expect(formatValue(null, 'g')).toBe('sin dato')
    expect(formatValue(undefined, 'kcal')).toBe('sin dato')
  })

  it('FR-006: un cero real se muestra como cero y no se confunde con un faltante', () => {
    expect(formatValue(0, 'g')).toBe('0 g')
    expect(formatValue(0, 'kcal')).toBe('0 kcal')
  })

  it('no inventa precisión: un solo decimal como máximo y la energía sin decimales', () => {
    expect(formatValue(3.456, 'g')).toBe('3,5 g')
    expect(formatValue(61.6, 'kcal')).toBe('62 kcal')
    expect(formatValue(12, 'g')).toBe('12 g')
  })

  it('separa los miles con el formato regional', () => {
    expect(formatValue(1250, 'mg')).toBe('1.250 mg')
  })
})

describe('parseDecimal', () => {
  it('FR-019: acepta coma y punto decimal', () => {
    expect(parseDecimal('12,5')).toEqual({ valid: true, value: 12.5 })
    expect(parseDecimal('12.5')).toEqual({ valid: true, value: 12.5 })
  })

  it('un campo vacío es "sin dato", no un error ni un cero', () => {
    expect(parseDecimal('')).toEqual({ valid: true, value: null })
    expect(parseDecimal('   ')).toEqual({ valid: true, value: null })
  })

  it('ignora espacios en los extremos y acepta enteros', () => {
    expect(parseDecimal('  7 ')).toEqual({ valid: true, value: 7 })
  })

  it('rechaza texto, varios separadores y notación científica', () => {
    for (const bad of ['abc', '1,2,3', '1.234,5', '1e3', '12,', ',5x', '--3']) {
      expect(parseDecimal(bad).valid, bad).toBe(false)
    }
  })

  it('un negativo se interpreta como número (el rango lo valida el esquema)', () => {
    expect(parseDecimal('-3')).toEqual({ valid: true, value: -3 })
  })
})

describe('energyCoherence (FR-018)', () => {
  it('coherente: la energía declarada coincide con 4·P + 4·C + 9·G', () => {
    // 4*3 + 4*5 + 9*3,3 = 61,7 kcal frente a 62
    const result = energyCoherence({ energy: 62, protein: 3, carbs: 5, fat: 3.3 })
    expect(result.coherent).toBe(true)
    expect(result.expected).toBeCloseTo(61.7, 1)
  })

  it('avisa solo si la diferencia supera el 25 % Y los 30 kcal', () => {
    // esperado 100 (4*10 + 4*10 + 9*2,22...); energía 200: diferencia 100 (100 %)
    expect(energyCoherence({ energy: 200, protein: 10, carbs: 15, fat: 0 }).coherent).toBe(false)
    // diferencia de 20 kcal sobre 100: no supera los 30 kcal
    expect(energyCoherence({ energy: 120, protein: 10, carbs: 15, fat: 0 }).coherent).toBe(true)
    // diferencia de 40 kcal sobre 400: supera 30 kcal pero no el 25 %
    expect(energyCoherence({ energy: 440, protein: 25, carbs: 75, fat: 0 }).coherent).toBe(true)
  })

  it('no opina con datos insuficientes (falta algún macronutriente o la energía)', () => {
    expect(energyCoherence({ energy: 200, protein: null, carbs: 10, fat: 5 }).coherent).toBe(true)
    expect(energyCoherence({ energy: null, protein: 10, carbs: 10, fat: 5 }).coherent).toBe(true)
    expect(
      energyCoherence({ energy: 200, protein: null, carbs: null, fat: null }).expected,
    ).toBeNull()
  })

  it('informa la diferencia aproximada', () => {
    const result = energyCoherence({ energy: 300, protein: 10, carbs: 15, fat: 0 })
    expect(result.coherent).toBe(false)
    expect(result.difference).toBe(200)
  })
})

describe('basisLabel y NUTRIENTS', () => {
  it('FR-005: la base de referencia siempre se nombra', () => {
    expect(basisLabel('100g')).toBe('por 100 g')
    expect(basisLabel('100ml')).toBe('por 100 ml')
  })

  it('FR-005: los nutrientes están en el orden y con las unidades de la spec', () => {
    expect(NUTRIENTS.map((n) => [n.key, n.unit])).toEqual([
      ['energy_kcal', 'kcal'],
      ['protein_g', 'g'],
      ['carbs_g', 'g'],
      ['sugars_g', 'g'],
      ['fat_g', 'g'],
      ['saturated_fat_g', 'g'],
      ['fiber_g', 'g'],
      ['sodium_mg', 'mg'],
    ])
  })

  it('los subtotales (azúcares y saturadas) se distinguen de los totales', () => {
    const sub = NUTRIENTS.filter((n) => n.indent).map((n) => n.key)
    expect(sub).toEqual(['sugars_g', 'saturated_fat_g'])
  })
})

describe('formatAmount (FR-007)', () => {
  it('muestra la cantidad de una porción con la unidad de su base', () => {
    expect(formatAmount(30, '100g')).toBe('30 g')
    expect(formatAmount(200, '100ml')).toBe('200 ml')
    expect(formatAmount(7.5, '100g')).toBe('7,5 g')
    expect(formatAmount(1250, '100g')).toBe('1.250 g')
  })
})
