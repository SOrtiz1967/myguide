// Spec 010: alimentación por semana, contra valores calculados a mano.
import { describe, expect, it } from 'vitest'
import type { GoalChange } from '../../src/features/goals/goalHistory'
import {
  buildNutritionWeeks,
  inGoalRange,
  proteinPerKg,
  type DayNutrition,
} from '../../src/features/trends/nutrition'
import { periodWeeks, periodRange, weekOf } from '../../src/features/trends/weeks'

function day(
  log_date: string,
  energy: number | null,
  protein: number | null = null,
  carbs: number | null = null,
  fat: number | null = null,
): DayNutrition {
  return {
    log_date,
    entries: 1,
    energy_kcal: energy,
    energy_count: energy === null ? 0 : 1,
    protein_g: protein,
    protein_count: protein === null ? 0 : 1,
    carbs_g: carbs,
    carbs_count: carbs === null ? 0 : 1,
    fat_g: fat,
    fat_count: fat === null ? 0 : 1,
  }
}

// Hoy es el miércoles 2026-10-14: las 4 semanas son los lunes 09-21, 09-28, 10-05 y 10-12 (en curso).
const TODAY = '2026-10-14'
const weeks = periodWeeks('4w', TODAY)
const goal = (kcal: number | null, from: string, created = `${from}T08:00:00Z`): GoalChange => ({
  effective_from: from,
  kcal,
  created_at: created,
})

describe('semanas', () => {
  it('van de lunes a domingo y la última es la en curso', () => {
    expect(weeks.map((w) => w.start)).toEqual([
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ])
    expect(weeks[0]!.end).toBe('2026-09-27')
    expect(weeks.map((w) => w.current)).toEqual([false, false, false, true])
  })

  it('el rango pedido empieza en el primer lunes y termina hoy', () => {
    expect(periodRange('4w', TODAY)).toEqual({ from: '2026-09-21', to: TODAY })
    expect(periodWeeks('1y', TODAY)).toHaveLength(52)
  })

  it('ubica un día en su semana o ninguna', () => {
    expect(weekOf(weeks, '2026-10-11')?.start).toBe('2026-10-05')
    expect(weekOf(weeks, '2026-09-20')).toBeUndefined()
  })
})

describe('promedios semanales', () => {
  // Semana del 10-05: tres días con registro (1800, 2000, 2200) y dos sin registro.
  const days = [
    day('2026-10-05', 1800, 100, 200, 60),
    day('2026-10-06', 2000, 120, null, 70),
    day('2026-10-08', 2200, null, 250, 80),
  ]

  it('promedia solo los días con registro y dice cuántos son', () => {
    const [, , week] = buildNutritionWeeks(days, weeks, [])
    expect(week!.recordedDays).toBe(3)
    expect(week!.averages.energy_kcal).toEqual({ value: 2000, days: 3 })
  })

  it('cada nutriente se promedia con los días que lo informan, nunca con ceros', () => {
    const [, , week] = buildNutritionWeeks(days, weeks, [])
    expect(week!.averages.protein_g).toEqual({ value: 110, days: 2 })
    expect(week!.averages.carbs_g).toEqual({ value: 225, days: 2 })
    expect(week!.averages.fat_g).toEqual({ value: 70, days: 3 })
  })

  it('una semana sin registro queda sin dato y no en cero', () => {
    const [first] = buildNutritionWeeks(days, weeks, [])
    expect(first!.recordedDays).toBe(0)
    expect(first!.averages.energy_kcal).toEqual({ value: null, days: 0 })
    expect(first!.daysWithGoal).toBe(0)
  })

  it('un día cuyas entradas no informan calorías no es un día con registro', () => {
    const [, , week] = buildNutritionWeeks([day('2026-10-07', null, 50)], weeks, [])
    expect(week!.recordedDays).toBe(0)
    expect(week!.averages.protein_g).toEqual({ value: 50, days: 1 })
  })
})

describe('días dentro del rango de más o menos 10 %', () => {
  it('los límites cuentan: 1.800 y 2.200 con objetivo 2.000', () => {
    expect(inGoalRange(1800, 2000)).toBe(true)
    expect(inGoalRange(2200, 2000)).toBe(true)
    expect(inGoalRange(1799, 2000)).toBe(false)
    expect(inGoalRange(2201, 2000)).toBe(false)
  })

  it('cuenta los días con registro dentro del rango del objetivo de esa semana', () => {
    const days = [
      day('2026-10-05', 1800),
      day('2026-10-06', 2000),
      day('2026-10-07', 1500),
      day('2026-10-08', 2300),
    ]
    const [, , week] = buildNutritionWeeks(days, weeks, [goal(2000, '2026-09-01')])
    expect(week!.daysWithGoal).toBe(4)
    expect(week!.daysInRange).toBe(2)
    expect(week!.goals).toEqual([2000])
  })

  it('compara cada día con el objetivo que regía ese día', () => {
    // El objetivo pasa de 2.000 a 2.500 el jueves 10-08.
    const history = [goal(2000, '2026-09-01'), goal(2500, '2026-10-08')]
    const days = [day('2026-10-07', 1900), day('2026-10-08', 2400)]
    const [, , week] = buildNutritionWeeks(days, weeks, history)
    // 1.900 está dentro de 2.000 ±10 %; 2.400 está dentro de 2.500 ±10 % (pero no de 2.000).
    expect(week!.daysInRange).toBe(2)
    expect(week!.goals).toEqual([2000, 2500])
  })

  it('sin objetivo, o con el objetivo quitado, no hay conteo', () => {
    const days = [day('2026-10-06', 2000)]
    expect(buildNutritionWeeks(days, weeks, [])[2]!.daysWithGoal).toBe(0)
    const removed = [goal(2000, '2026-09-01', '2026-09-01T08:00:00Z'), goal(null, '2026-10-01')]
    const week = buildNutritionWeeks(days, weeks, removed)[2]!
    expect(week.daysWithGoal).toBe(0)
    expect(week.goals).toEqual([])
  })
})

describe('proteína por kilo', () => {
  const days = [
    day('2026-10-05', 1800, 100),
    day('2026-10-06', 2000, 140),
    day('2026-10-07', 2000, null),
  ]

  it('usa el último peso hasta el final del período y dice cuál y de cuándo', () => {
    const weights = [
      { date: '2026-09-30', value: 81 },
      { date: '2026-10-10', value: 80 },
      { date: '2026-10-20', value: 70 },
    ]
    const result = proteinPerKg(days, weights, TODAY)
    // Promedio 120 g (2 días con proteína) sobre 80 kg.
    expect(result.protein).toEqual({ value: 120, days: 2 })
    expect(result.weight).toEqual({ date: '2026-10-10', value: 80 })
    expect(result.value).toBe(1.5)
  })

  it('sin peso o sin proteína no hay cifra y no se estima ninguno', () => {
    expect(proteinPerKg(days, [], TODAY).value).toBeNull()
    expect(proteinPerKg(days, [], TODAY).weight).toBeNull()
    expect(
      proteinPerKg([day('2026-10-05', 2000)], [{ date: '2026-10-01', value: 80 }], TODAY).value,
    ).toBeNull()
  })
})
