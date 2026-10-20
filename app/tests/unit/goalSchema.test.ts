import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { goalFormSchema, parseGoalInput } from '../../src/features/goals/schema'

// Spec 004, FR-003 y FR-004 (research, Decisión 7): una regla única para leer el número.
const v = es.goal.validation

describe('parseGoalInput: se lee como número', () => {
  it.each([
    ['2000', 2000],
    ['2.000', 2000],
    ['1.250', 1250],
    ['2000,0', 2000],
    ['2000.0', 2000],
    [' 2000 ', 2000],
    ['1000', 1000],
    ['6000', 6000],
    ['6.000', 6000],
    ['1199', 1199],
  ])('«%s» → %i', (text, kcal) => {
    expect(parseGoalInput(text)).toEqual({ ok: true, kcal })
  })

  it('«12.000» se lee como 12000 y el rango lo rechaza', () => {
    expect(parseGoalInput('12.000')).toEqual({ ok: false, message: v.range })
  })
})

describe('parseGoalInput: se rechaza con su mensaje', () => {
  it.each([
    ['', v.empty],
    ['   ', v.empty],
    ['abc', v.notNumber],
    ['-2000', v.notNumber],
    ['2e3', v.notNumber],
    ['2000 kcal', v.notNumber],
    ['1,800,5', v.notNumber],
    ['1800,5', v.notInteger],
    ['1800.5', v.notInteger],
    ['1.5', v.notInteger],
    ['999', v.range],
    ['6001', v.range],
    ['20000', v.range],
    ['0', v.range],
    ['6.001', v.range],
  ])('«%s»', (text, message) => {
    expect(parseGoalInput(text)).toEqual({ ok: false, message })
  })
})

describe('goalFormSchema', () => {
  it('convierte el texto del campo en kcal enteras', () => {
    expect(goalFormSchema.parse({ kcal: '2.000' })).toEqual({ kcal: 2000 })
  })

  it('devuelve el mensaje en el campo kcal', () => {
    const result = goalFormSchema.safeParse({ kcal: '999' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['kcal'])
      expect(result.error.issues[0]?.message).toBe(v.range)
    }
  })
})
