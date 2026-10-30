// Spec 021: cuándo corresponde un aviso (FR-004 a FR-007).
import { describe, expect, it } from 'vitest'
import { isDue, isoWeekday, type Reminder } from '../../src/features/reminders/due'

// 2026-10-30 es viernes (5); 2026-10-26 es lunes (1); 2026-11-01 es domingo (7).
const TODAY = '2026-10-30'

const base: Reminder = {
  kind: 'weight',
  enabled: true,
  frequency: 'daily',
  every_n: null,
  weekdays: null,
  snoozed_until: null,
}
const daily = (over: Partial<Reminder> = {}): Reminder => ({ ...base, ...over })
const every = (n: number, over: Partial<Reminder> = {}): Reminder => ({
  ...base,
  frequency: 'every_n_days',
  every_n: n,
  ...over,
})
const onDays = (weekdays: number[], over: Partial<Reminder> = {}): Reminder => ({
  ...base,
  frequency: 'weekdays',
  weekdays,
  ...over,
})
const ctx = (over: Partial<{ lastDoneOn: string | null; doneToday: boolean }> = {}) => ({
  today: TODAY,
  lastDoneOn: null,
  doneToday: false,
  ...over,
})

describe('isoWeekday', () => {
  it('lunes es 1 y domingo es 7', () => {
    expect(isoWeekday('2026-10-26')).toBe(1)
    expect(isoWeekday('2026-10-30')).toBe(5)
    expect(isoWeekday('2026-11-01')).toBe(7)
  })
})

describe('isDue: lo común', () => {
  it('apagado nunca corresponde', () => {
    expect(isDue(daily({ enabled: false }), ctx())).toBe(false)
    expect(isDue(every(3, { enabled: false }), ctx())).toBe(false)
  })

  it('si hoy ya está registrado no corresponde, con cualquier frecuencia', () => {
    expect(isDue(daily(), ctx({ doneToday: true }))).toBe(false)
    expect(isDue(every(2), ctx({ doneToday: true, lastDoneOn: '2026-10-01' }))).toBe(false)
    expect(isDue(onDays([5]), ctx({ doneToday: true }))).toBe(false)
  })

  it('«más tarde» oculta hasta pasada la fecha', () => {
    expect(isDue(daily({ snoozed_until: '2026-10-31' }), ctx())).toBe(false)
    // La fecha de hoy ya no oculta: «hasta mañana» significa que mañana vuelve.
    expect(isDue(daily({ snoozed_until: '2026-10-30' }), ctx())).toBe(true)
    expect(isDue(daily({ snoozed_until: '2026-10-29' }), ctx())).toBe(true)
  })
})

describe('isDue: todos los días', () => {
  it('corresponde cualquier día sin registro, haya o no un registro anterior', () => {
    expect(isDue(daily(), ctx())).toBe(true)
    expect(isDue(daily(), ctx({ lastDoneOn: '2026-10-29' }))).toBe(true)
  })
})

describe('isDue: cada tantos días', () => {
  it('sin ningún registro corresponde', () => {
    expect(isDue(every(7), ctx({ lastDoneOn: null }))).toBe(true)
  })

  it('con el último registro justo hace N días corresponde', () => {
    expect(isDue(every(7), ctx({ lastDoneOn: '2026-10-23' }))).toBe(true)
  })

  it('con el último registro hace menos de N días no corresponde', () => {
    expect(isDue(every(7), ctx({ lastDoneOn: '2026-10-24' }))).toBe(false)
    expect(isDue(every(2), ctx({ lastDoneOn: '2026-10-29' }))).toBe(false)
  })

  it('con el último registro hace más de N días corresponde', () => {
    expect(isDue(every(7), ctx({ lastDoneOn: '2026-09-01' }))).toBe(true)
  })

  it('cuenta días de calendario a través del cambio de hora', () => {
    expect(
      isDue(every(8), { today: '2026-11-01', lastDoneOn: '2026-10-24', doneToday: false }),
    ).toBe(true)
    expect(
      isDue(every(9), { today: '2026-11-01', lastDoneOn: '2026-10-24', doneToday: false }),
    ).toBe(false)
  })

  it('sin el número configurado no corresponde (no se inventa uno)', () => {
    expect(isDue({ ...base, frequency: 'every_n_days', every_n: null }, ctx())).toBe(false)
  })
})

describe('isDue: ciertos días de la semana', () => {
  it('corresponde solo en los días elegidos', () => {
    expect(isDue(onDays([5]), ctx())).toBe(true)
    expect(isDue(onDays([1, 3, 5]), ctx())).toBe(true)
    expect(isDue(onDays([1, 3]), ctx())).toBe(false)
    expect(isDue(onDays([6, 7]), ctx())).toBe(false)
  })

  it('el domingo es 7', () => {
    expect(isDue(onDays([7]), { today: '2026-11-01', lastDoneOn: null, doneToday: false })).toBe(
      true,
    )
  })

  it('sin días configurados no corresponde', () => {
    expect(isDue({ ...base, frequency: 'weekdays', weekdays: null }, ctx())).toBe(false)
    expect(isDue(onDays([]), ctx())).toBe(false)
  })
})
