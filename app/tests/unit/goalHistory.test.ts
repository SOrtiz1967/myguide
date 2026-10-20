import { describe, expect, it } from 'vitest'
import { currentGoal, goalOn, type GoalChange } from '../../src/features/goals/goalHistory'

// Spec 004, FR-008 a FR-011 (research, Decisiones 1 y 3): el objetivo de un día es el del cambio más
// recientemente guardado entre los que ya regían ese día.
const change = (effective_from: string, kcal: number | null, created_at: string): GoalChange => ({
  effective_from,
  kcal,
  created_at,
})

// El ejemplo de data-model.md.
const example: GoalChange[] = [
  change('2026-10-01', 2000, '2026-10-01T09:10:00Z'),
  change('2026-10-12', 1800, '2026-10-12T21:30:00Z'),
  change('2026-10-12', 1900, '2026-10-12T21:45:00Z'),
  change('2026-10-15', null, '2026-10-15T08:00:00Z'),
]

describe('goalOn', () => {
  it('sin cambios no hay objetivo', () => {
    expect(goalOn([], '2026-10-19')).toBeNull()
  })

  it.each([
    ['2026-09-30', null],
    ['2026-10-01', 2000],
    ['2026-10-11', 2000],
    ['2026-10-12', 1900],
    ['2026-10-14', 1900],
    ['2026-10-15', null],
    ['2026-10-30', null],
  ])('el ejemplo de data-model.md: %s → %s', (day, expected) => {
    expect(goalOn(example, day)).toBe(expected)
  })

  it('el orden del arreglo no importa: gana el último guardado (FR-009)', () => {
    expect(goalOn([...example].reverse(), '2026-10-13')).toBe(1900)
    expect(goalOn([example[2]!, example[1]!], '2026-10-13')).toBe(1900)
  })

  it('una zona que retrocede: gana el último guardado aunque su fecha sea anterior', () => {
    const history = [
      change('2026-10-20', 2000, '2026-10-19T23:30:00Z'), // guardado antes, con la zona adelantada
      change('2026-10-19', 1800, '2026-10-20T01:00:00Z'), // guardado después, con la zona retrocedida
    ]
    expect(goalOn(history, '2026-10-20')).toBe(1800)
    expect(goalOn(history, '2026-10-19')).toBe(1800)
  })

  it('una fila posterior al día consultado se ignora', () => {
    expect(goalOn([change('2026-10-20', 1500, '2026-10-19T10:00:00Z')], '2026-10-19')).toBeNull()
  })

  it('quitar y volver a fijar: los días intermedios quedan sin objetivo (FR-010)', () => {
    const history = [
      change('2026-10-01', 2000, '2026-10-01T09:00:00Z'),
      change('2026-10-10', null, '2026-10-10T09:00:00Z'),
      change('2026-10-15', 1700, '2026-10-15T09:00:00Z'),
    ]
    expect(goalOn(history, '2026-10-09')).toBe(2000)
    expect(goalOn(history, '2026-10-12')).toBeNull()
    expect(goalOn(history, '2026-10-15')).toBe(1700)
  })

  it('una fecha futura (hasta 7 días) rige con el valor vigente hoy (FR-011)', () => {
    expect(goalOn(example.slice(0, 3), '2026-10-19')).toBe(1900)
    expect(goalOn(example.slice(0, 3), '2026-10-25')).toBe(1900)
  })

  it('lee marcas de tiempo de Postgres con microsegundos', () => {
    const history = [
      change('2026-10-12', 1800, '2026-10-12T21:30:00.123456+00:00'),
      change('2026-10-12', 1900, '2026-10-12T21:30:00.223456+00:00'),
    ]
    expect(goalOn(history, '2026-10-12')).toBe(1900)
  })
})

describe('currentGoal', () => {
  it('sin cambios no hay objetivo vigente', () => {
    expect(currentGoal([], '2026-10-19')).toBeNull()
  })

  it('devuelve el valor y desde cuándo rige', () => {
    expect(currentGoal(example, '2026-10-13')).toEqual({ kcal: 1900, since: '2026-10-12' })
    expect(currentGoal(example, '2026-10-05')).toEqual({ kcal: 2000, since: '2026-10-01' })
  })

  it('guardar el mismo valor otra vez no mueve la fecha', () => {
    const history = [
      change('2026-10-01', 2000, '2026-10-01T09:00:00Z'),
      change('2026-10-12', 2000, '2026-10-12T09:00:00Z'),
    ]
    expect(currentGoal(history, '2026-10-19')).toEqual({ kcal: 2000, since: '2026-10-01' })
  })

  it('un valor distinto en el medio corta la racha', () => {
    const history = [
      change('2026-10-01', 2000, '2026-10-01T09:00:00Z'),
      change('2026-10-05', 1800, '2026-10-05T09:00:00Z'),
      change('2026-10-12', 2000, '2026-10-12T09:00:00Z'),
    ]
    expect(currentGoal(history, '2026-10-19')).toEqual({ kcal: 2000, since: '2026-10-12' })
  })

  it('si el último cambio quitó el objetivo no hay objetivo vigente', () => {
    expect(currentGoal(example, '2026-10-19')).toBeNull()
  })

  it('un cambio posterior a hoy no cuenta', () => {
    const history = [
      change('2026-10-01', 2000, '2026-10-01T09:00:00Z'),
      change('2026-10-25', 1500, '2026-10-19T09:00:00Z'),
    ]
    expect(currentGoal(history, '2026-10-19')).toEqual({ kcal: 2000, since: '2026-10-01' })
  })
})
