import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import {
  barScale,
  calorieState,
  trainingState,
  weekDays,
  weekdayIndex,
} from '../../src/features/week/week'
import { findTrainingForbidden } from '../support/trainingForbiddenTerms'

const today = '2026-10-28' // miércoles

describe('semana', () => {
  it('empieza el lunes y tiene siete días', () => {
    expect(weekDays('2026-10-28')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
    expect(weekDays('2026-10-26')[0]).toBe('2026-10-26')
    expect(weekDays('2026-11-01')[0]).toBe('2026-10-26')
    expect(weekdayIndex('2026-10-26')).toBe(0)
    expect(weekdayIndex('2026-11-01')).toBe(6)
  })
})

describe('estado de calorías', () => {
  const base = { today, goal: 2000, entries: 2 }

  it('en rango dentro de ±10 % del objetivo, con los bordes incluidos', () => {
    for (const registered of [1800, 2000, 2200]) {
      expect(calorieState({ ...base, date: '2026-10-27', registered })).toBe('in-range')
    }
  })

  it('por debajo y por encima fuera de ese rango', () => {
    expect(calorieState({ ...base, date: '2026-10-27', registered: 1799 })).toBe('below')
    expect(calorieState({ ...base, date: '2026-10-27', registered: 2201 })).toBe('above')
  })

  it('sin ítems es «Sin registro», que no es «Por debajo»', () => {
    expect(calorieState({ ...base, date: '2026-10-27', registered: 0, entries: 0 })).toBe(
      'no-record',
    )
  })

  it('hoy no se juzga: queda «En curso» hasta que termina el día', () => {
    expect(calorieState({ ...base, date: today, registered: 300 })).toBe('in-progress')
    expect(calorieState({ ...base, date: today, registered: 0, entries: 0 })).toBe('no-record')
  })

  it('un día futuro no tiene estado y sin objetivo no hay estado', () => {
    expect(calorieState({ ...base, date: '2026-10-29', registered: 0, entries: 0 })).toBe('future')
    expect(calorieState({ ...base, goal: null, date: '2026-10-27', registered: 500 })).toBe(
      'no-goal',
    )
  })
})

describe('estado de entrenamiento', () => {
  const s = (status: 'planned' | 'in_progress' | 'completed' | 'cancelled') => ({ status })

  it('hecho, en curso, planificado, sin registrar, cancelado y sin sesión', () => {
    expect(trainingState([s('completed')], '2026-10-27', today)).toBe('done')
    expect(trainingState([s('in_progress')], today, today)).toBe('in-progress')
    expect(trainingState([s('planned')], '2026-10-29', today)).toBe('planned')
    expect(trainingState([s('planned')], today, today)).toBe('planned')
    expect(trainingState([s('planned')], '2026-10-27', today)).toBe('unlogged')
    expect(trainingState([s('cancelled')], '2026-10-27', today)).toBe('cancelled')
    expect(trainingState([], '2026-10-27', today)).toBe('none')
  })

  it('con varias sesiones gana la más relevante', () => {
    expect(trainingState([s('cancelled'), s('completed')], '2026-10-27', today)).toBe('done')
    expect(trainingState([s('planned'), s('in_progress')], today, today)).toBe('in-progress')
    expect(trainingState([s('cancelled'), s('planned')], '2026-10-27', today)).toBe('unlogged')
  })
})

describe('barra del día', () => {
  it('la franja va de 0,9 a 1,1 veces el objetivo sobre una escala de 1,5', () => {
    const scale = barScale(2000, 1000)
    expect(scale.value).toBeCloseTo(1000 / 3000)
    expect(scale.low).toBeCloseTo(1800 / 3000)
    expect(scale.high).toBeCloseTo(2200 / 3000)
  })

  it('lo registrado por encima de la escala no se sale de la barra', () => {
    expect(barScale(2000, 5000).value).toBe(1)
  })
})

describe('lenguaje', () => {
  it('los textos de la semana no usan términos prohibidos', () => {
    const texts: string[] = []
    const walk = (node: unknown) => {
      if (typeof node === 'string') texts.push(node)
      else if (typeof node === 'function') {
        const fn = node as (...args: unknown[]) => unknown
        const result = fn(...Array(Math.max(fn.length, 1)).fill('x'))
        if (typeof result === 'string') texts.push(result)
      } else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(es.week)
    expect(texts.length).toBeGreaterThan(40)
    expect(texts.flatMap((text) => findTrainingForbidden(text))).toEqual([])
  })
})
