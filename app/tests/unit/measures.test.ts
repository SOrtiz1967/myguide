import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import {
  formatMeasure,
  parseMeasure,
  unitOf,
  valueInput,
} from '../../src/features/measures/measures'
import { findTrainingForbidden } from '../support/trainingForbiddenTerms'

describe('parseMeasure', () => {
  it('acepta coma o punto y un decimal como máximo', () => {
    expect(parseMeasure('weight', '72,4')).toBe(72.4)
    expect(parseMeasure('weight', '72.4')).toBe(72.4)
    expect(parseMeasure('waist', ' 84 ')).toBe(84)
  })

  it('rechaza vacío, texto, unidades escritas y más de un decimal', () => {
    for (const text of ['', '   '])
      expect(parseMeasure('weight', text)).toBe(es.measures.validation.required)
    for (const text of ['abc', '72 kg', '72,45', '1.000,5', '-70', '7 2'])
      expect(parseMeasure('weight', text)).toBe(es.measures.validation.format)
  })

  it('respeta el rango de cada medida', () => {
    expect(parseMeasure('weight', '19,9')).toMatch(/20 y 500 kg/)
    expect(parseMeasure('weight', '500,1')).toMatch(/20 y 500 kg/)
    expect(parseMeasure('weight', '20')).toBe(20)
    expect(parseMeasure('hips', '9,9')).toMatch(/10 y 300 cm/)
    expect(parseMeasure('hips', '301')).toMatch(/10 y 300 cm/)
    expect(parseMeasure('hips', '300')).toBe(300)
  })
})

describe('formato', () => {
  it('muestra el valor con coma, un decimal y su unidad', () => {
    expect(formatMeasure('weight', 72.4)).toBe('72,4 kg')
    expect(formatMeasure('waist', 84)).toBe('84,0 cm')
    expect(unitOf('thigh')).toBe('cm')
    expect(valueInput(72.4)).toBe('72,4')
  })
})

describe('lenguaje', () => {
  it('los textos de medidas no usan términos prohibidos', () => {
    const texts: string[] = []
    const walk = (node: unknown) => {
      if (typeof node === 'string') texts.push(node)
      else if (typeof node === 'function') {
        const fn = node as (...a: unknown[]) => unknown
        const r = fn(...Array(Math.max(fn.length, 1)).fill('Peso'))
        if (typeof r === 'string') texts.push(r)
      } else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(es.measures)
    expect(texts.length).toBeGreaterThan(30)
    expect(texts.flatMap((text) => findTrainingForbidden(text))).toEqual([])
  })
})
