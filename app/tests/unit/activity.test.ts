import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { formatActivity, parseActivity, valueInput } from '../../src/features/activity/activity'
import { findTrainingForbidden } from '../support/trainingForbiddenTerms'

const v = es.activity.validation

describe('parseActivity', () => {
  it('sueño: acepta h:mm y horas decimales y lo pasa a minutos', () => {
    expect(parseActivity('sleep', '7:30')).toBe(450)
    expect(parseActivity('sleep', '07:05')).toBe(425)
    expect(parseActivity('sleep', '7,5')).toBe(450)
    expect(parseActivity('sleep', '8')).toBe(480)
    expect(parseActivity('sleep', '24:00')).toBe(1440)
  })

  it('sueño: rechaza vacío, formatos raros, 0 y más de 24 horas', () => {
    expect(parseActivity('sleep', '')).toBe(v.required)
    for (const text of ['abc', '7:60', '7h30', '-1', '7:5'])
      expect(parseActivity('sleep', text)).toBe(v.formatSleep)
    expect(parseActivity('sleep', '0')).toMatch(/entre 1 minuto y 24 horas/)
    expect(parseActivity('sleep', '24:01')).toMatch(/entre 1 minuto y 24 horas/)
  })

  it('pasos: enteros, con puntos de miles opcionales; 0 es un dato válido', () => {
    expect(parseActivity('steps', '8500')).toBe(8500)
    expect(parseActivity('steps', '8.500')).toBe(8500)
    expect(parseActivity('steps', '0')).toBe(0)
    expect(parseActivity('steps', '8,5')).toBe(v.formatNumber)
    expect(parseActivity('steps', '85.00')).toBe(v.formatNumber)
    expect(parseActivity('steps', '200001')).toMatch(/entre 0 y 200\.000/)
  })

  it('actividad: minutos enteros hasta 1.440', () => {
    expect(parseActivity('active_minutes', '40')).toBe(40)
    expect(parseActivity('active_minutes', '0')).toBe(0)
    expect(parseActivity('active_minutes', '1441')).toMatch(/entre 0 y 1\.440 minutos/)
    expect(parseActivity('active_minutes', '4,5')).toBe(v.formatNumber)
  })
})

describe('formato', () => {
  it('muestra cada valor con su unidad', () => {
    expect(formatActivity('sleep', 450)).toBe('7 h 30 min')
    expect(formatActivity('sleep', 480)).toBe('8 h')
    expect(formatActivity('steps', 8500)).toBe('8.500 pasos')
    expect(formatActivity('active_minutes', 40)).toBe('40 min')
    expect(valueInput('sleep', 425)).toBe('7:05')
    expect(valueInput('steps', 8500)).toBe('8500')
  })

  it('los textos de actividad no usan términos prohibidos', () => {
    const texts: string[] = []
    const walk = (node: unknown) => {
      if (typeof node === 'string') texts.push(node)
      else if (typeof node === 'function') {
        const fn = node as (...a: unknown[]) => unknown
        const r = fn(...Array(Math.max(fn.length, 1)).fill('sleep'))
        if (typeof r === 'string') texts.push(r)
      } else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(es.activity)
    expect(texts.length).toBeGreaterThan(30)
    expect(texts.flatMap((text) => findTrainingForbidden(text))).toEqual([])
  })
})
