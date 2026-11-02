// Spec 012 (FR-003 a FR-005, SC-003, SC-004, SC-006): cada medida contra valores calculados a mano.
import { describe, expect, it } from 'vitest'
import {
  computeMeasure,
  formatDifference,
  formatDuration,
  formatMeasure,
  MEASURES_BY_TYPE,
  type SetData,
} from '../../src/features/training/progress/measures'
import { inRange, periodRange, previousRange } from '../../src/features/training/progress/periods'

// Press: 8 x 60 kg, 6 x 62,5 kg, 5 x 70 kg
const press: SetData[] = [
  { reps: 8, weight_kg: 60 },
  { reps: 6, weight_kg: 62.5 },
  { reps: 5, weight_kg: 70 },
]

describe('medidas de repeticiones con peso', () => {
  it('peso máximo de la sesión', () => {
    expect(computeMeasure('max_weight', press)).toEqual({ value: 70, used: 3, excluded: 0 })
  })

  it('volumen = suma de repeticiones por peso: 480 + 375 + 350 = 1205', () => {
    expect(computeMeasure('volume', press)).toEqual({ value: 1205, used: 3, excluded: 0 })
  })

  it('repeticiones totales: 8 + 6 + 5 = 19', () => {
    expect(computeMeasure('total_reps', press)).toEqual({ value: 19, used: 3, excluded: 0 })
  })

  it('el volumen solo usa las series con repeticiones y peso, y dice cuántas dejó fuera', () => {
    const sets: SetData[] = [{ reps: 10, weight_kg: 20 }, { reps: 12 }, { weight_kg: 30 }]
    expect(computeMeasure('volume', sets)).toEqual({ value: 200, used: 1, excluded: 2 })
    expect(computeMeasure('max_weight', sets)).toEqual({ value: 30, used: 2, excluded: 1 })
    expect(computeMeasure('total_reps', sets)).toEqual({ value: 22, used: 2, excluded: 1 })
  })

  it('un peso de 0 es un dato, no una falta', () => {
    expect(computeMeasure('max_weight', [{ reps: 10, weight_kg: 0 }])).toEqual({
      value: 0,
      used: 1,
      excluded: 0,
    })
  })
})

describe('medidas de repeticiones sin peso, tiempo, distancia', () => {
  it('repeticiones totales y mayor número en una serie', () => {
    const sets: SetData[] = [{ reps: 15 }, { reps: 12 }, { reps: 10 }]
    expect(computeMeasure('total_reps', sets).value).toBe(37)
    expect(computeMeasure('max_reps', sets).value).toBe(15)
  })

  it('tiempo total y serie más larga', () => {
    const sets: SetData[] = [{ duration_s: 60 }, { duration_s: 45 }, { duration_s: 90 }]
    expect(computeMeasure('total_time', sets).value).toBe(195)
    expect(computeMeasure('longest_set', sets).value).toBe(90)
  })

  it('distancia total y tiempo total', () => {
    const sets: SetData[] = [
      { distance_km: 2.5, duration_s: 900 },
      { distance_km: 1.25, duration_s: 480 },
    ]
    expect(computeMeasure('total_distance', sets).value).toBe(3.75)
    expect(computeMeasure('total_time', sets).value).toBe(1380)
  })
})

describe('datos faltantes (SC-004)', () => {
  it('sin series o sin el dato necesario el valor es null, nunca cero', () => {
    expect(computeMeasure('max_weight', [])).toEqual({ value: null, used: 0, excluded: 0 })
    expect(computeMeasure('volume', [{ reps: 8 }, { reps: 9 }])).toEqual({
      value: null,
      used: 0,
      excluded: 2,
    })
    expect(computeMeasure('total_time', [{ reps: 8 }]).value).toBeNull()
  })
})

describe('qué medidas ofrece cada tipo', () => {
  it('solo las de su tipo (FR-003)', () => {
    expect(MEASURES_BY_TYPE.reps_weight).toEqual(['max_weight', 'volume', 'total_reps'])
    expect(MEASURES_BY_TYPE.reps_bodyweight).toEqual(['total_reps', 'max_reps'])
    expect(MEASURES_BY_TYPE.duration).toEqual(['total_time', 'longest_set'])
    expect(MEASURES_BY_TYPE.distance_duration).toEqual(['total_distance', 'total_time'])
    expect(MEASURES_BY_TYPE.duration).not.toContain('volume')
  })
})

describe('formato con unidad y coma decimal (FR-024, SC-006)', () => {
  it('pesos, distancias, repeticiones y duraciones', () => {
    expect(formatMeasure(62.5, 'kg')).toBe('62,5 kg')
    expect(formatMeasure(1205, 'kg')).toBe('1.205 kg')
    expect(formatMeasure(3.75, 'km')).toBe('3,75 km')
    expect(formatMeasure(1, 'reps')).toBe('1 repetición')
    expect(formatMeasure(19, 'reps')).toBe('19 repeticiones')
    expect(formatMeasure(45, 's')).toBe('45 s')
  })

  it('duraciones largas', () => {
    expect(formatDuration(750)).toBe('12 min 30 s')
    expect(formatDuration(720)).toBe('12 min')
    expect(formatDuration(3900)).toBe('1 h 5 min')
    expect(formatDuration(3600)).toBe('1 h')
  })

  it('las diferencias llevan signo y unidad, sin calificar', () => {
    expect(formatDifference(2.5, 'kg')).toBe('+2,5 kg')
    expect(formatDifference(-3, 'reps')).toBe('−3 repeticiones')
    expect(formatDifference(0, 'kg')).toBe('0 kg')
    expect(formatDifference(-90, 's')).toBe('−1 min 30 s')
  })
})

describe('períodos', () => {
  it('4 semanas son 28 días que terminan hoy', () => {
    expect(periodRange('4w', '2026-11-01')).toEqual({ from: '2026-10-05', to: '2026-11-01' })
    expect(periodRange('12w', '2026-11-01')).toEqual({ from: '2026-08-10', to: '2026-11-01' })
    expect(periodRange('all', '2026-11-01')).toEqual({ from: null, to: '2026-11-01' })
  })

  it('el período anterior es contiguo y del mismo largo; «todo» no se compara', () => {
    expect(previousRange('4w', '2026-11-01')).toEqual({ from: '2026-09-07', to: '2026-10-04' })
    expect(previousRange('all', '2026-11-01')).toBeNull()
  })

  it('inRange incluye los dos extremos', () => {
    const range = periodRange('4w', '2026-11-01')
    expect(inRange('2026-10-05', range)).toBe(true)
    expect(inRange('2026-11-01', range)).toBe(true)
    expect(inRange('2026-10-04', range)).toBe(false)
    expect(inRange('2026-11-02', range)).toBe(false)
    expect(inRange('1999-01-01', { from: null, to: '2026-11-01' })).toBe(true)
  })
})
