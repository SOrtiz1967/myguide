// T014 (spec 003, FR-008, FR-017, FR-024, FR-026): comidas, fechas del día y agrupación.
import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatDay,
  formatDayMonth,
  formatDayShort,
  groupByMeal,
  isDateInRange,
  MEALS,
  mealLabel,
  parseDate,
  suggestMeal,
  todayIn,
} from '../../src/features/meals/meals'

describe('comidas (FR-008)', () => {
  it('son cinco, en este orden', () => {
    expect([...MEALS]).toEqual(['breakfast', 'lunch', 'snack', 'dinner', 'extra'])
  })

  it('tienen su etiqueta en español', () => {
    expect(MEALS.map(mealLabel)).toEqual(['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Colación'])
  })
})

describe('parseDate', () => {
  it('acepta fechas reales en formato AAAA-MM-DD', () => {
    expect(parseDate('2026-10-19')).toBe('2026-10-19')
    expect(parseDate('2028-02-29')).toBe('2028-02-29')
  })

  it('rechaza lo que no es una fecha real o no tiene ese formato', () => {
    for (const bad of [
      '2026-02-30',
      '2026-13-01',
      '2027-02-29',
      '19/10/2026',
      '2026-1-1',
      'hoy',
      '',
    ]) {
      expect(parseDate(bad), bad).toBeNull()
    }
  })
})

describe('addDays', () => {
  it('suma y resta días entre meses y años', () => {
    expect(addDays('2026-10-19', 1)).toBe('2026-10-20')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-10-19', 7)).toBe('2026-10-26')
  })

  it('no se altera con el cambio de horario de verano', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('todayIn (FR-024)', () => {
  const instant = new Date('2026-10-19T02:30:00Z')

  it('usa la zona horaria indicada, no la del dispositivo', () => {
    expect(todayIn('America/Argentina/Buenos_Aires', instant)).toBe('2026-10-18')
    expect(todayIn('Europe/Madrid', instant)).toBe('2026-10-19')
    expect(todayIn('Pacific/Auckland', instant)).toBe('2026-10-19')
  })

  it('corta a las 00:00 de esa zona', () => {
    expect(todayIn('America/Argentina/Buenos_Aires', new Date('2026-10-19T02:59:59Z'))).toBe(
      '2026-10-18',
    )
    expect(todayIn('America/Argentina/Buenos_Aires', new Date('2026-10-19T03:00:00Z'))).toBe(
      '2026-10-19',
    )
  })

  it('con una zona inválida usa UTC', () => {
    expect(todayIn('No/Existe', instant)).toBe('2026-10-19')
  })
})

describe('formato del día', () => {
  it('formatDay: día de la semana, número y mes', () => {
    expect(formatDay('2026-10-19')).toBe('lunes 19 de octubre')
    expect(formatDay('2026-10-18')).toBe('domingo 18 de octubre')
    expect(formatDay('2026-01-01')).toBe('jueves 1 de enero')
  })

  it('formatDayMonth: día y mes', () => {
    expect(formatDayMonth('2026-10-12')).toBe('12 de octubre')
    expect(formatDayMonth('2026-01-01')).toBe('1 de enero')
  })

  it('formatDayShort: día de la semana y número', () => {
    expect(formatDayShort('2026-10-19')).toBe('lunes 19')
    expect(formatDayShort('2026-10-18')).toBe('domingo 18')
  })
})

describe('isDateInRange (FR-024, FR-027)', () => {
  it('admite desde el 1/1/2000 hasta 7 días después de hoy', () => {
    expect(isDateInRange('2000-01-01', '2026-10-19')).toBe(true)
    expect(isDateInRange('1999-12-31', '2026-10-19')).toBe(false)
    expect(isDateInRange('2026-10-26', '2026-10-19')).toBe(true)
    expect(isDateInRange('2026-10-27', '2026-10-19')).toBe(false)
  })
})

describe('groupByMeal', () => {
  it('devuelve las cinco comidas, también las vacías, y conserva el orden dentro de cada una', () => {
    const entries = [
      { id: 'a', meal: 'lunch' as const },
      { id: 'b', meal: 'breakfast' as const },
      { id: 'c', meal: 'lunch' as const },
    ]
    const grouped = groupByMeal(entries)
    expect(Object.keys(grouped)).toEqual([...MEALS])
    expect(grouped.lunch.map((e) => e.id)).toEqual(['a', 'c'])
    expect(grouped.breakfast.map((e) => e.id)).toEqual(['b'])
    expect(grouped.dinner).toEqual([])
  })
})

describe('suggestMeal', () => {
  it('propone la comida según la hora local', () => {
    const at = (hour: number) => new Date(2026, 9, 19, hour, 30)
    expect(suggestMeal(at(8))).toBe('breakfast')
    expect(suggestMeal(at(13))).toBe('lunch')
    expect(suggestMeal(at(17))).toBe('snack')
    expect(suggestMeal(at(21))).toBe('dinner')
    expect(suggestMeal(at(1))).toBe('breakfast')
  })
})
