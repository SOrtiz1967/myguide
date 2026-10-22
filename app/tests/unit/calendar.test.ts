// T053 (spec 006, FR-021, FR-026): cuadrícula del mes, rangos, nombres accesibles y estados de un día.
import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayCounts,
  dayLabel,
  gridRange,
  isValidDay,
  monthGrid,
  monthOf,
  monthTitle,
  sessionState,
  sessionStateLabel,
  shiftMonth,
} from '../../src/features/training/calendar'

describe('monthGrid', () => {
  it('empieza en lunes y completa con días del mes anterior y del siguiente', () => {
    // octubre de 2026 empieza en jueves y termina en sábado
    const weeks = monthGrid({ year: 2026, month: 10 })
    expect(weeks).toHaveLength(5)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0]![0]).toEqual({ date: '2026-09-28', inMonth: false })
    expect(weeks[0]![3]).toEqual({ date: '2026-10-01', inMonth: true })
    expect(weeks[4]![6]).toEqual({ date: '2026-11-01', inMonth: false })
  })

  it('un mes que empieza en lunes y termina en domingo no suma días ajenos', () => {
    // junio de 2026 empieza en lunes y termina en martes; febrero de 2027 empieza en lunes y termina en domingo
    const weeks = monthGrid({ year: 2027, month: 2 })
    expect(weeks).toHaveLength(4)
    expect(weeks.flat().every((day) => day.inMonth)).toBe(true)
  })

  it('el rango cubre la primera y la última celda', () => {
    expect(gridRange({ year: 2026, month: 10 })).toEqual({ from: '2026-09-28', to: '2026-11-01' })
  })
})

describe('fechas', () => {
  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('cambia de mes cruzando el año', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(monthOf('2026-10-22')).toEqual({ year: 2026, month: 10 })
    expect(monthTitle({ year: 2026, month: 10 })).toBe('octubre de 2026')
  })

  it('valida fechas reales', () => {
    expect(isValidDay('2026-10-22')).toBe(true)
    expect(isValidDay('2026-02-31')).toBe(false)
    expect(isValidDay('22/10/2026')).toBe(false)
    expect(isValidDay(undefined)).toBe(false)
  })
})

describe('estado de un día', () => {
  const today = '2026-10-22'
  const planned = (session_date: string) => ({ status: 'planned' as const, session_date })

  it('una planificada con fecha pasada es «Sin registrar»; de hoy o futura sigue planificada', () => {
    expect(sessionState(planned('2026-10-20'), today)).toBe('unrecorded')
    expect(sessionState(planned('2026-10-22'), today)).toBe('planned')
    expect(sessionState(planned('2026-10-25'), today)).toBe('planned')
    expect(sessionStateLabel(planned('2026-10-20'), today)).toBe('Sin registrar')
    expect(sessionStateLabel(planned('2026-10-25'), today)).toBe('Planificada')
  })

  it('cuenta por estado en un orden fijo', () => {
    const sessions = [
      { status: 'cancelled' as const, session_date: '2026-10-22' },
      planned('2026-10-22'),
      { status: 'completed' as const, session_date: '2026-10-22' },
      planned('2026-10-22'),
    ]
    expect(dayCounts(sessions, today)).toEqual([
      { state: 'completed', count: 1 },
      { state: 'planned', count: 2 },
      { state: 'cancelled', count: 1 },
    ])
  })

  it('el nombre accesible dice el día y el estado con palabras', () => {
    expect(
      dayLabel(
        '2026-10-22',
        [
          { status: 'completed', session_date: '2026-10-22' },
          { status: 'planned', session_date: '2026-10-22' },
        ],
        today,
      ),
    ).toBe('jueves 22 de octubre: 1 sesión realizada, 1 planificada')
    expect(dayLabel('2026-10-23', [], today)).toBe('viernes 23 de octubre: sin sesiones')
    expect(dayLabel('2026-10-20', [planned('2026-10-20')], today)).toBe(
      'martes 20 de octubre: 1 sin registrar',
    )
  })
})
