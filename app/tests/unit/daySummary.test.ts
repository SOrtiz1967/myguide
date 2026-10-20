import { describe, expect, it } from 'vitest'
import { sumEntries } from '../../src/features/meals/mealTotals'
import { summarizeDay, type SummaryEntry } from '../../src/features/goals/daySummary'

// Spec 004, FR-012 a FR-017, FR-021, SC-003, SC-009 (research, Decisión 4).
const item = (
  energy_kcal: number | null,
  status: 'confirmed' | 'pending' = 'confirmed',
): SummaryEntry => ({
  energy_kcal,
  status,
})

describe('summarizeDay con objetivo', () => {
  it('por debajo del objetivo: restan 650 y el avance es 68 %', () => {
    const s = summarizeDay([item(1000), item(350)], 2000)
    expect(s).toMatchObject({
      state: 'under',
      goal: 2000,
      registered: 1350,
      remaining: 650,
      percent: 68,
      pending: 0,
      missing: 0,
      lowerBound: false,
    })
    expect('difference' in s).toBe(false)
  })

  it('exactamente el objetivo: restan 0', () => {
    const s = summarizeDay([item(2000)], 2000)
    expect(s).toMatchObject({ state: 'met', remaining: 0, percent: 100 })
    expect('difference' in s).toBe(false)
  })

  it('por encima del objetivo: informa la diferencia', () => {
    const s = summarizeDay([item(2250)], 2000)
    expect(s).toMatchObject({
      state: 'over',
      registered: 2250,
      remaining: -250,
      difference: 250,
      percent: 113,
    })
  })

  it('día vacío: 0 registradas y el objetivo completo como restante', () => {
    const s = summarizeDay([], 2000)
    expect(s).toMatchObject({
      state: 'under',
      registered: 0,
      remaining: 2000,
      percent: 0,
      missing: 0,
    })
  })

  it('un ítem con energía 0 es dato, no un faltante', () => {
    const s = summarizeDay([item(0), item(500)], 2000)
    expect(s).toMatchObject({ registered: 500, missing: 0, lowerBound: false })
  })

  it('un ítem sin energía no suma, se cuenta aparte y vuelve el restante un máximo', () => {
    const s = summarizeDay([item(1350), item(null), item(null)], 2000)
    expect(s).toMatchObject({ registered: 1350, missing: 2, lowerBound: true, remaining: 650 })
  })

  it('los estimados pendientes suman a lo registrado y su parte va aparte', () => {
    const s = summarizeDay([item(1000), item(300, 'pending')], 2000)
    expect(s).toMatchObject({ registered: 1300, pending: 300, remaining: 700, missing: 0 })
  })

  it('un estimado sin energía no aporta a lo estimado y cuenta como faltante', () => {
    const s = summarizeDay([item(null, 'pending')], 2000)
    expect(s).toMatchObject({ registered: 0, pending: 0, missing: 1, lowerBound: true })
  })

  it('suma primero y redondea después (0,4 + 0,4 + 0,4 = 1)', () => {
    const s = summarizeDay([item(0.4), item(0.4), item(0.4)], 2000)
    expect(s.registered).toBe(1)
  })

  it('la cuenta visible cierra con el total ya redondeado', () => {
    const s = summarizeDay([item(1000.4), item(349.4)], 2000)
    expect(s.registered).toBe(1350)
    expect('remaining' in s && s.remaining).toBe(2000 - s.registered)
  })

  it('coincide con el total de energía de la vista del día (spec 003)', () => {
    const entries = [item(120.3), item(80.2), item(null), item(410.6, 'pending')]
    const total = sumEntries(
      entries.map((e) => ({
        energy_kcal: e.energy_kcal,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      })),
    )
    expect(summarizeDay(entries, 1800).registered).toBe(Math.round(total.energy_kcal.value ?? 0))
  })
})

describe('summarizeDay sin objetivo', () => {
  it.each([null, undefined])(
    'con goal %s no existe ningún campo del objetivo (FR-002, SC-009)',
    (goal) => {
      const s = summarizeDay([item(1350), item(null)], goal)
      expect(s.state).toBe('none')
      for (const key of ['goal', 'remaining', 'difference', 'percent']) {
        expect(key in s).toBe(false)
      }
      expect(s).toMatchObject({ registered: 1350, pending: 0, missing: 1, lowerBound: true })
    },
  )

  it('un día vacío sin objetivo solo informa 0 registradas', () => {
    expect(summarizeDay([], null)).toEqual({
      state: 'none',
      registered: 0,
      pending: 0,
      missing: 0,
      lowerBound: false,
    })
  })
})

describe('rendimiento', () => {
  it('60 ítems se resumen en menos de 5 ms', () => {
    const entries = Array.from({ length: 60 }, (_, i) =>
      item(i % 7 === 0 ? null : 100 + i, i % 5 === 0 ? 'pending' : 'confirmed'),
    )
    const start = performance.now()
    for (let i = 0; i < 20; i++) summarizeDay(entries, 2000)
    const average = (performance.now() - start) / 20
    console.log(`MEDICION summarizeDay con 60 ítems: ${average.toFixed(4)} ms`)
    expect(average).toBeLessThan(5)
  })
})
