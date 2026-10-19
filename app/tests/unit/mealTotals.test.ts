// T012 (spec 003, FR-014 a FR-016, SC-006): subtotales y totales del día, con los faltantes marcados.
import { describe, expect, it } from 'vitest'
import { formatTotal, sumEntries, type EntryValues } from '../../src/features/meals/mealTotals'

const entry = (overrides: Partial<EntryValues> = {}): EntryValues => ({
  energy_kcal: 100,
  protein_g: 10,
  carbs_g: 20,
  fat_g: 5,
  ...overrides,
})

describe('sumEntries', () => {
  it('FR-014: suma energía, proteínas, carbohidratos y grasas', () => {
    const totals = sumEntries([entry(), entry({ energy_kcal: 250.5, protein_g: 4.5 })])
    expect(totals.energy_kcal).toEqual({ value: 350.5, missing: 0, count: 2, complete: true })
    expect(totals.protein_g.value).toBe(14.5)
    expect(totals.carbs_g.value).toBe(40)
    expect(totals.fat_g.value).toBe(10)
  })

  it('FR-015: un nutriente que falta en algún ítem marca el total como incompleto y cuenta cuántos faltan', () => {
    const totals = sumEntries([entry(), entry({ fat_g: null }), entry({ fat_g: null }), entry()])
    expect(totals.fat_g).toEqual({ value: 10, missing: 2, count: 4, complete: false })
    // los demás nutrientes siguen completos
    expect(totals.energy_kcal.complete).toBe(true)
  })

  it('FR-005: un faltante no se cuenta como 0 y un cero real sí suma como dato', () => {
    const totals = sumEntries([entry({ fat_g: 0 }), entry({ fat_g: null })])
    expect(totals.fat_g.value).toBe(0)
    expect(totals.fat_g.missing).toBe(1)
  })

  it('si ningún ítem informa un nutriente, el total no tiene valor', () => {
    const totals = sumEntries([entry({ carbs_g: null }), entry({ carbs_g: null })])
    expect(totals.carbs_g).toEqual({ value: null, missing: 2, count: 2, complete: false })
  })

  it('sin ítems no hay totales que mostrar', () => {
    const totals = sumEntries([])
    expect(totals.energy_kcal).toEqual({ value: null, missing: 0, count: 0, complete: false })
  })

  it('SC-006: la suma se hace antes de redondear', () => {
    // 3 × 0,44 = 1,32 → "1,3 g"; si se redondeara cada uno (0,4) daría 1,2
    const totals = sumEntries([
      entry({ protein_g: 0.44 }),
      entry({ protein_g: 0.44 }),
      entry({ protein_g: 0.44 }),
    ])
    expect(formatTotal(totals.protein_g, 'g')).toBe('1,3 g')
  })

  it('evita el error de punto flotante al sumar decimales', () => {
    const totals = sumEntries([entry({ protein_g: 0.1 }), entry({ protein_g: 0.2 })])
    expect(totals.protein_g.value).toBe(0.3)
  })
})

describe('formatTotal (FR-015, FR-016)', () => {
  it('un total completo se muestra con su unidad y el formato regional', () => {
    const totals = sumEntries([entry({ energy_kcal: 1000.4 }), entry({ energy_kcal: 250 })])
    expect(formatTotal(totals.energy_kcal, 'kcal')).toBe('1.250 kcal')
  })

  it('un total incompleto dice "al menos" y cuántos ítems no lo informan', () => {
    const totals = sumEntries([
      entry({ protein_g: 30 }),
      entry({ protein_g: 15 }),
      entry({ protein_g: null }),
      entry({ protein_g: null }),
    ])
    expect(formatTotal(totals.protein_g, 'g')).toBe('al menos 45 g · falta en 2 ítems')
  })

  it('en singular cuando falta en un solo ítem', () => {
    const totals = sumEntries([entry({ fat_g: 8 }), entry({ fat_g: null })])
    expect(formatTotal(totals.fat_g, 'g')).toBe('al menos 8 g · falta en 1 ítem')
  })

  it('sin ningún dato dice "sin dato"', () => {
    const totals = sumEntries([entry({ carbs_g: null })])
    expect(formatTotal(totals.carbs_g, 'g')).toBe('sin dato')
  })

  it('el gramo lleva como máximo un decimal y la energía ninguno', () => {
    const totals = sumEntries([entry({ energy_kcal: 61.6, carbs_g: 3.456 })])
    expect(formatTotal(totals.energy_kcal, 'kcal')).toBe('62 kcal')
    expect(formatTotal(totals.carbs_g, 'g')).toBe('3,5 g')
  })
})
