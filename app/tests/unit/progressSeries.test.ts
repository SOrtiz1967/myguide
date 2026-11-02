// Spec 012 (FR-005, FR-007, FR-010 a FR-012, FR-015, SC-003, SC-005): puntos, tendencia, comparación y actividad.
import { describe, expect, it } from 'vitest'
import { countSessions, weekStart } from '../../src/features/training/progress/activity'
import {
  buildProgressSeries,
  compareRanges,
  type ProgressRow,
} from '../../src/features/training/progress/series'

const row = (
  id: string,
  date: string,
  sets: ProgressRow['sets'],
  effort: number | null = null,
): ProgressRow => ({
  session_id: id,
  session_date: date,
  exercise_name: 'Press',
  measurement_type: 'reps_weight',
  effort,
  sets,
})

const range = { from: '2026-10-01', to: '2026-11-01' }

describe('buildProgressSeries', () => {
  const rows = [
    row('a', '2026-09-20', [{ reps: 5, weight_kg: 50 }]), // fuera del período
    row(
      'b',
      '2026-10-02',
      [
        { reps: 8, weight_kg: 60 },
        { reps: 6, weight_kg: 62.5 },
      ],
      7,
    ),
    row('c', '2026-10-09', [{ reps: 8, weight_kg: 65 }, { reps: 12 }]),
    row('d', '2026-10-16', [{ reps: 12 }]), // ninguna serie con peso
    row('e', '2026-10-23', [{ reps: 5, weight_kg: 70 }]),
  ]

  it('un punto por sesión del período, con su fecha, valor, esfuerzo y series usadas', () => {
    const series = buildProgressSeries(rows, 'max_weight', range)
    expect(series.points.map((p) => [p.date, p.value])).toEqual([
      ['2026-10-02', 62.5],
      ['2026-10-09', 65],
      ['2026-10-23', 70],
    ])
    expect(series.points[0]).toMatchObject({ effort: 7, usedSets: 2, excludedSets: 0 })
    expect(series.points[1]).toMatchObject({ effort: null, usedSets: 1, excludedSets: 1 })
    expect(series.sessions).toBe(4)
  })

  it('FR-005: una sesión sin dato utilizable no es un punto ni vale cero', () => {
    const series = buildProgressSeries(rows, 'max_weight', range)
    expect(series.noData).toEqual([{ key: 'd:3', date: '2026-10-16', excludedSets: 1 }])
    expect(series.points.every((p) => p.value > 0)).toBe(true)
  })

  it('cuenta las series excluidas por no tener el dato', () => {
    expect(buildProgressSeries(rows, 'max_weight', range).excludedSets).toBe(2)
    expect(buildProgressSeries(rows, 'total_reps', range).excludedSets).toBe(0)
  })

  it('FR-007/SC-005: con 3 sesiones con dato hay línea; con menos, no', () => {
    expect(buildProgressSeries(rows, 'max_weight', range).showTrend).toBe(true)
    const two = buildProgressSeries(rows.slice(0, 3), 'max_weight', range)
    expect(two.points).toHaveLength(2)
    expect(two.showTrend).toBe(false)
    expect(buildProgressSeries([], 'max_weight', range)).toMatchObject({
      points: [],
      sessions: 0,
      showTrend: false,
    })
  })

  it('dos sesiones el mismo día son dos puntos con claves distintas', () => {
    const same = [
      row('x', '2026-10-05', [{ reps: 5, weight_kg: 40 }]),
      row('y', '2026-10-05', [{ reps: 5, weight_kg: 45 }]),
    ]
    const series = buildProgressSeries(same, 'max_weight', range)
    expect(series.points.map((p) => p.date)).toEqual(['2026-10-05', '2026-10-05'])
    expect(new Set(series.points.map((p) => p.key)).size).toBe(2)
  })

  it('un valor muy fuera de lo habitual se grafica como está', () => {
    const series = buildProgressSeries(
      [row('z', '2026-10-05', [{ reps: 5, weight_kg: 900 }])],
      'max_weight',
      range,
    )
    expect(series.points[0]!.value).toBe(900)
  })

  it('todo el historial no recorta por fecha', () => {
    const series = buildProgressSeries(rows, 'max_weight', { from: null, to: '2026-11-01' })
    expect(series.points).toHaveLength(4)
  })
})

describe('compareRanges (FR-010 a FR-012)', () => {
  const rows = [
    // período anterior (septiembre): 60, 70 → promedio 65
    row('p1', '2026-09-05', [{ reps: 5, weight_kg: 60 }]),
    row('p2', '2026-09-20', [{ reps: 5, weight_kg: 70 }]),
    // período actual (octubre): 62,5; 67,5; 72,5 → promedio 67,5
    row('c1', '2026-10-03', [{ reps: 5, weight_kg: 62.5 }]),
    row('c2', '2026-10-12', [{ reps: 5, weight_kg: 67.5 }]),
    row('c3', '2026-10-25', [{ reps: 5, weight_kg: 72.5 }]),
  ]
  const current = { from: '2026-10-01', to: '2026-10-31' }
  const previous = { from: '2026-09-01', to: '2026-09-30' }

  it('promedio por sesión de cada período, cantidad de sesiones y diferencia exacta', () => {
    const result = compareRanges(rows, 'max_weight', current, previous)
    expect(result.current).toMatchObject({ sessions: 3, average: 67.5, enough: true })
    expect(result.previous).toMatchObject({ sessions: 2, average: 65, enough: true })
    expect(result.difference).toBe(2.5)
  })

  it('la diferencia puede ser negativa o cero, sin calificarse', () => {
    expect(compareRanges(rows, 'max_weight', previous, current).difference).toBe(-2.5)
    expect(compareRanges(rows, 'max_weight', current, current).difference).toBe(0)
  })

  it('con menos de 2 sesiones con dato en un período no hay diferencia', () => {
    const result = compareRanges(rows.slice(1), 'max_weight', current, previous)
    expect(result.previous).toMatchObject({ sessions: 1, enough: false })
    expect(result.difference).toBeNull()

    const none = compareRanges([], 'max_weight', current, previous)
    expect(none.current).toMatchObject({ sessions: 0, average: null, enough: false })
    expect(none.difference).toBeNull()
  })

  it('las sesiones sin dato para la medida no cuentan como sesiones del período', () => {
    const withGap = [...rows, row('gap', '2026-10-28', [{ reps: 12 }])]
    expect(compareRanges(withGap, 'max_weight', current, previous).current.sessions).toBe(3)
  })
})

describe('actividad por semana y por mes (FR-013, FR-014)', () => {
  it('las semanas van de lunes a domingo', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26') // domingo
    expect(weekStart('2026-10-26')).toBe('2026-10-26') // lunes
    expect(weekStart('2026-10-28')).toBe('2026-10-26')
  })

  it('cuenta las sesiones realizadas de cada semana y deja en cero las vacías', () => {
    const dates = ['2026-10-05', '2026-10-06', '2026-10-19', '2026-10-25', '2026-10-26']
    const weeks = countSessions(dates, { from: '2026-10-05', to: '2026-11-01' }, 'week')
    expect(weeks.map((w) => [w.start, w.end, w.count])).toEqual([
      ['2026-10-05', '2026-10-11', 2],
      ['2026-10-12', '2026-10-18', 0],
      ['2026-10-19', '2026-10-25', 2],
      ['2026-10-26', '2026-11-01', 1],
    ])
  })

  it('cuenta por mes, con los meses de largo distinto', () => {
    const dates = ['2026-08-31', '2026-09-01', '2026-09-30', '2026-11-01']
    const months = countSessions(dates, { from: '2026-08-01', to: '2026-11-01' }, 'month')
    expect(months.map((m) => [m.start, m.end, m.count])).toEqual([
      ['2026-08-01', '2026-08-31', 1],
      ['2026-09-01', '2026-09-30', 2],
      ['2026-10-01', '2026-10-31', 0],
      ['2026-11-01', '2026-11-30', 1],
    ])
  })

  it('los meses cruzan el año', () => {
    const months = countSessions(
      ['2026-12-31', '2027-01-01'],
      { from: '2026-12-01', to: '2027-01-31' },
      'month',
    )
    expect(months.map((m) => [m.start, m.count])).toEqual([
      ['2026-12-01', 1],
      ['2027-01-01', 1],
    ])
  })

  it('«todo el historial» empieza en la primera sesión y sin sesiones no hay tramos', () => {
    const range = { from: null, to: '2026-11-01' }
    expect(countSessions([], range, 'week')).toEqual([])
    const weeks = countSessions(['2026-10-20'], range, 'week', '2026-10-20')
    expect(weeks.map((w) => w.start)).toEqual(['2026-10-19', '2026-10-26'])
  })

  it('ignora las fechas fuera del período', () => {
    const weeks = countSessions(
      ['2026-01-01', '2027-01-01'],
      { from: '2026-10-05', to: '2026-10-11' },
      'week',
    )
    expect(weeks.map((w) => w.count)).toEqual([0])
  })
})
