// Spec 020: cálculo de la evolución del peso (FR-003 a FR-007, FR-010, FR-011).
import { describe, expect, it } from 'vitest'
import {
  addDaysTo,
  averageSegments,
  buildSeries,
  dateTicks,
  daysBetween,
  niceTicks,
  periodStart,
  shortDate,
  weightStats,
  xRatio,
  yDomain,
  type SeriesPoint,
  type WeightPoint,
} from '../../src/features/measures/weightSeries'

const w = (date: string, value: number, fasting = false): WeightPoint => ({ date, value, fasting })
const p = (date: string, value: number, avg: number | null): SeriesPoint => ({
  date,
  value,
  fasting: false,
  avg,
})

describe('buildSeries: promedio de 7 días', () => {
  it('con menos de 3 registros en la ventana no hay promedio', () => {
    const { points } = buildSeries([w('2026-10-01', 72), w('2026-10-02', 74)], null, false)
    expect(points.map((x) => x.avg)).toEqual([null, null])
  })

  it('con 3 registros en la ventana el promedio es la media', () => {
    const { points } = buildSeries(
      [w('2026-10-01', 72), w('2026-10-02', 74), w('2026-10-03', 73)],
      null,
      false,
    )
    expect(points.map((x) => x.avg)).toEqual([null, null, 73])
  })

  it('la ventana son los 7 días que terminan en el registro, incluido ese día', () => {
    const { points } = buildSeries(
      [
        w('2026-10-01', 70),
        w('2026-10-05', 72),
        w('2026-10-06', 74),
        w('2026-10-07', 76),
        w('2026-10-08', 78),
      ],
      null,
      false,
    )
    // 10-07: ventana 10-01..10-07 -> 70, 72, 74, 76 = 73. 10-08: ventana 10-02..10-08 -> 72, 74, 76, 78 = 75.
    expect(points[3]!.avg).toBe(73)
    expect(points[4]!.avg).toBe(75)
  })

  it('un registro de hace 7 días ya no entra en la ventana', () => {
    const { points } = buildSeries(
      [w('2026-10-01', 60), w('2026-10-06', 72), w('2026-10-07', 74), w('2026-10-08', 76)],
      null,
      false,
    )
    // 10-08: ventana 10-02..10-08, sin el 10-01 -> 72, 74, 76 = 74.
    expect(points[3]!.avg).toBe(74)
  })

  it('los días sin registro no se rellenan: el promedio es de lo registrado', () => {
    const { points } = buildSeries(
      [w('2026-10-01', 70), w('2026-10-04', 72), w('2026-10-07', 77)],
      null,
      false,
    )
    expect(points[2]!.avg).toBe(73)
  })

  it('el primer día del período usa los días anteriores para su ventana', () => {
    const { points } = buildSeries(
      [w('2026-09-30', 72), w('2026-10-01', 74), w('2026-10-02', 73), w('2026-10-03', 75)],
      '2026-10-02',
      false,
    )
    expect(points.map((x) => x.date)).toEqual(['2026-10-02', '2026-10-03'])
    expect(points[0]!.avg).toBe(73)
    expect(points[1]!.avg).toBe(73.5)
  })
})

describe('buildSeries: solo en ayunas', () => {
  const data = [
    w('2026-10-01', 72, true),
    w('2026-10-02', 80, false),
    w('2026-10-03', 74, true),
    w('2026-10-04', 73, true),
  ]

  it('usa solo los marcados, también para el promedio', () => {
    const { points, excluded } = buildSeries(data, null, true)
    expect(points.map((x) => x.value)).toEqual([72, 74, 73])
    expect(points[2]!.avg).toBeCloseTo(73)
    expect(excluded).toBe(1)
  })

  it('sin el filtro no excluye nada', () => {
    const { points, excluded } = buildSeries(data, null, false)
    expect(points).toHaveLength(4)
    expect(excluded).toBe(0)
  })

  it('cuenta como excluidos solo los del período, no los de la ventana previa', () => {
    const { excluded } = buildSeries(data, '2026-10-02', true)
    expect(excluded).toBe(1)
    expect(buildSeries(data, '2026-10-03', true).excluded).toBe(0)
  })

  it('con menos de 3 marcados en la ventana no hay promedio', () => {
    const { points } = buildSeries(
      [w('2026-10-01', 72, true), w('2026-10-02', 74, true)],
      null,
      true,
    )
    expect(points.every((x) => x.avg === null)).toBe(true)
  })
})

describe('averageSegments', () => {
  it('une los promedios cercanos y corta si pasan más de 7 días', () => {
    const segments = averageSegments([
      p('2026-10-03', 73, 73),
      p('2026-10-04', 73, 73.5),
      p('2026-10-12', 72, 72),
    ])
    expect(segments.map((s) => s.map((x) => x.date))).toEqual([
      ['2026-10-03', '2026-10-04'],
      ['2026-10-12'],
    ])
  })

  it('exactamente 7 días entre dos promedios no corta', () => {
    const segments = averageSegments([p('2026-10-03', 73, 73), p('2026-10-10', 72, 72)])
    expect(segments).toHaveLength(1)
  })

  it('los puntos sin promedio no entran en la línea ni la cortan por sí solos', () => {
    const segments = averageSegments([
      p('2026-10-03', 73, 73),
      p('2026-10-05', 74, null),
      p('2026-10-06', 74, 74),
    ])
    expect(segments).toHaveLength(1)
    expect(segments[0]).toHaveLength(2)
  })

  it('sin promedios no hay tramos', () => {
    expect(averageSegments([p('2026-10-03', 73, null)])).toEqual([])
  })
})

describe('weightStats', () => {
  it('sin registros no hay cifras', () => {
    expect(weightStats([])).toBeNull()
  })

  it('cantidad, último, mínimo, máximo y promedio del último', () => {
    const stats = weightStats([
      p('2026-10-01', 72, null),
      p('2026-10-02', 70, null),
      p('2026-10-03', 75, 72.3),
    ])!
    expect(stats.count).toBe(3)
    expect(stats.last.date).toBe('2026-10-03')
    expect(stats.lastAverage).toBe(72.3)
    expect(stats.min.value).toBe(70)
    expect(stats.max.value).toBe(75)
  })

  it('con empate se queda con el más antiguo', () => {
    const stats = weightStats([p('2026-10-01', 72, null), p('2026-10-05', 72, null)])!
    expect(stats.min.date).toBe('2026-10-01')
    expect(stats.max.date).toBe('2026-10-01')
  })

  it('con un solo registro no hay promedio', () => {
    expect(weightStats([p('2026-10-01', 72, null)])!.lastAverage).toBeNull()
  })
})

describe('eje vertical', () => {
  it('agrega un margen del 10 % al rango', () => {
    const { min, max } = yDomain([p('2026-10-01', 70, null), p('2026-10-02', 80, null)])
    expect(min).toBeCloseTo(69)
    expect(max).toBeCloseTo(81)
  })

  it('con valores iguales se ensancha 0,5 kg a cada lado', () => {
    const { min, max } = yDomain([p('2026-10-01', 72, null)])
    expect(min).toBe(71.5)
    expect(max).toBe(72.5)
  })

  it('el promedio también entra en el rango', () => {
    const { max } = yDomain([p('2026-10-01', 72, 80)])
    expect(max).toBeGreaterThan(80)
  })

  it('las marcas son números redondos dentro del rango', () => {
    expect(niceTicks(71.4, 74.6)).toEqual([72, 73, 74])
    for (const tick of niceTicks(60.3, 98.1)) {
      expect(tick).toBeGreaterThanOrEqual(60.3)
      expect(tick).toBeLessThanOrEqual(98.1)
    }
  })
})

describe('períodos y fechas', () => {
  it('30 y 90 días incluyen hoy', () => {
    expect(periodStart('30d', '2026-10-30')).toBe('2026-10-01')
    expect(periodStart('90d', '2026-10-30')).toBe('2026-08-02')
  })

  it('6 meses y 1 año, ajustando fin de mes', () => {
    expect(periodStart('6m', '2026-10-30')).toBe('2026-04-30')
    expect(periodStart('6m', '2026-08-31')).toBe('2026-02-28')
    expect(periodStart('1y', '2026-10-30')).toBe('2025-10-30')
    expect(periodStart('1y', '2028-02-29')).toBe('2027-02-28')
  })

  it('«Todo» no tiene inicio', () => {
    expect(periodStart('all', '2026-10-30')).toBeNull()
  })

  it('sumar y contar días no se descuadra con cambios de hora', () => {
    expect(addDaysTo('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDaysTo('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-24', '2026-11-01')).toBe(8)
  })

  it('marcas de fecha parejas y su texto', () => {
    expect(dateTicks('2026-10-01', '2026-10-31', 4)).toEqual([
      '2026-10-01',
      '2026-10-11',
      '2026-10-21',
      '2026-10-31',
    ])
    expect(dateTicks('2026-10-01', '2026-10-01')).toEqual(['2026-10-01'])
    expect(shortDate('2026-10-05')).toBe('5 oct')
    expect(shortDate('2026-10-05', true)).toBe('5 oct 26')
  })

  it('posición de una fecha entre dos extremos', () => {
    expect(xRatio('2026-10-16', '2026-10-01', '2026-10-31')).toBe(0.5)
    expect(xRatio('2026-10-01', '2026-10-01', '2026-10-01')).toBe(0.5)
  })
})
