// Spec 010: estimación de mantenimiento, contra un caso calculado a mano.
import { describe, expect, it } from 'vitest'
import { estimateMaintenance, maintenanceWindow } from '../../src/features/trends/maintenance'
import type { DayNutrition } from '../../src/features/trends/nutrition'

function day(log_date: string, energy: number | null): DayNutrition {
  return {
    log_date,
    entries: 1,
    energy_kcal: energy,
    energy_count: energy === null ? 0 : 1,
    protein_g: null,
    protein_count: 0,
    carbs_g: null,
    carbs_count: 0,
    fat_g: null,
    fat_count: 0,
  }
}

// Hoy es 2026-11-22: la ventana son los 21 días terminados, del 2026-11-01 al 2026-11-21.
const TODAY = '2026-11-22'
const WINDOW_DAYS = Array.from(
  { length: 14 },
  (_, i) => `2026-11-${String(i + 5).padStart(2, '0')}`,
)
const eating = WINDOW_DAYS.map((date) => day(date, 2000))

describe('ventana', () => {
  it('son los 21 días terminados antes de hoy', () => {
    expect(maintenanceWindow(TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-21' })
  })
})

describe('con datos suficientes', () => {
  // Inicio: 11-02 (80,0 kg) y 11-04 (80,4 kg): promedio 80,2 kg, fecha media 11-03 (día 2 de la ventana).
  // Final: 11-19 (79,6 kg) y 11-21 (79,2 kg): promedio 79,4 kg, fecha media 11-20 (día 19).
  const weights = [
    { date: '2026-11-02', value: 80 },
    { date: '2026-11-04', value: 80.4 },
    { date: '2026-11-19', value: 79.6 },
    { date: '2026-11-21', value: 79.2 },
  ]

  it('calcula la estimación y su rango a mano', () => {
    const result = estimateMaintenance(eating, weights, TODAY)
    expect(result.ready).toBe(true)
    if (!result.ready) return
    const e = result.estimate
    expect(e.calorieDays).toBe(14)
    expect(e.weighIns).toBe(4)
    expect(e.averageKcal).toBe(2000)
    expect(e.startWeight).toBeCloseTo(80.2, 10)
    expect(e.endWeight).toBeCloseTo(79.4, 10)
    expect(e.elapsedDays).toBe(17)
    // 2000 − (79,4 − 80,2) × 7700 / 17 = 2000 + 362,35… = 2362,35…
    expect(e.estimate).toBeCloseTo(2362.35, 2)
    // Incertidumbre: √(0,25/2 + 0,25/2) = 0,5 kg → 0,5 × 7700 / 17 = 226,47… kcal.
    // 2362,35 − 226,47 = 2135,88 → 2140; 2362,35 + 226,47 = 2588,82 → 2590.
    expect(e.low).toBe(2140)
    expect(e.high).toBe(2590)
  })

  it('un peso estable da una estimación cercana a lo comido', () => {
    const flat = [
      { date: '2026-11-02', value: 80 },
      { date: '2026-11-04', value: 80 },
      { date: '2026-11-19', value: 80 },
      { date: '2026-11-21', value: 80 },
    ]
    const result = estimateMaintenance(eating, flat, TODAY)
    expect(result.ready && result.estimate.estimate).toBe(2000)
  })

  it('ignora lo que cae fuera de la ventana (hoy y antes de la ventana)', () => {
    const extra = [...weights, { date: '2026-10-30', value: 90 }, { date: '2026-11-22', value: 60 }]
    const days = [...eating, day('2026-11-22', 100), day('2026-10-31', 9999)]
    const result = estimateMaintenance(days, extra, TODAY)
    expect(result.ready && result.estimate.weighIns).toBe(4)
    expect(result.ready && result.estimate.averageKcal).toBe(2000)
  })
})

describe('con datos insuficientes no hay cifra y se dice qué falta', () => {
  const weights = [
    { date: '2026-11-02', value: 80 },
    { date: '2026-11-04', value: 80 },
    { date: '2026-11-19', value: 79 },
    { date: '2026-11-21', value: 79 },
  ]

  it('menos de 14 días con calorías', () => {
    const result = estimateMaintenance(eating.slice(0, 9), weights, TODAY)
    expect(result.ready).toBe(false)
    if (result.ready) return
    expect(result.calorieDays).toBe(9)
    expect(result.missing.calorieDays).toBe(5)
    expect(result.missing.weighIns).toBe(0)
  })

  it('los días sin calorías no cuentan', () => {
    const days = [...eating.slice(0, 13), day('2026-11-18', null)]
    const result = estimateMaintenance(days, weights, TODAY)
    expect(!result.ready && result.missing.calorieDays).toBe(1)
  })

  it('menos de 4 pesajes', () => {
    const result = estimateMaintenance(eating, weights.slice(1, 4), TODAY)
    expect(result.ready).toBe(false)
    if (result.ready) return
    expect(result.weighIns).toBe(3)
    expect(result.missing.weighIns).toBe(1)
  })

  it('pesajes sin ninguno en uno de los extremos', () => {
    const onlyEnd = [
      { date: '2026-11-12', value: 80 },
      { date: '2026-11-13', value: 80 },
      { date: '2026-11-19', value: 79 },
      { date: '2026-11-21', value: 79 },
    ]
    const result = estimateMaintenance(eating, onlyEnd, TODAY)
    expect(result.ready).toBe(false)
    if (result.ready) return
    expect(result.missing.startEdge).toBe(true)
    expect(result.missing.endEdge).toBe(false)
    expect(result.missing.weighIns).toBe(0)
  })

  it('sin ningún dato falta todo', () => {
    const result = estimateMaintenance([], [], TODAY)
    expect(result.ready).toBe(false)
    if (result.ready) return
    expect(result.missing).toEqual({ calorieDays: 14, weighIns: 4, startEdge: true, endEdge: true })
  })
})
