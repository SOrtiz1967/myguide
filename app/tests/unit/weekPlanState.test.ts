// Spec 018, FR-017/FR-018: el estado de entrenamiento de un día considera el plan semanal.
import { describe, expect, it } from 'vitest'
import { isoWeekday } from '../../src/features/training/useWeeklyPlan'
import { trainingState } from '../../src/features/week/week'

const TODAY = '2026-10-28'

describe('trainingState con plan semanal', () => {
  it('un día futuro con rutina asignada y sin sesión es «Plan»', () => {
    expect(trainingState([], '2026-10-30', TODAY, true)).toBe('planned')
  })

  it('hoy con rutina asignada y sin sesión es «Plan»', () => {
    expect(trainingState([], TODAY, TODAY, true)).toBe('planned')
  })

  it('un día pasado con rutina asignada y sin sesión es «Sin registro», sin juicio', () => {
    expect(trainingState([], '2026-10-26', TODAY, true)).toBe('unlogged')
  })

  it('un día sin rutina asignada y sin sesión no muestra nada', () => {
    expect(trainingState([], '2026-10-27', TODAY, false)).toBe('none')
  })

  it('con una sesión realizada es «Hecho» aunque el plan diga otra cosa', () => {
    expect(trainingState([{ status: 'completed' }], '2026-10-26', TODAY, true)).toBe('done')
  })

  it('una sesión planificada a mano manda sobre el plan y no se cuenta dos veces', () => {
    expect(trainingState([{ status: 'planned' }], '2026-10-30', TODAY, true)).toBe('planned')
    expect(trainingState([{ status: 'planned' }], '2026-10-26', TODAY, true)).toBe('unlogged')
  })

  it('una sesión cancelada a mano no vuelve como plan', () => {
    expect(trainingState([{ status: 'cancelled' }], '2026-10-30', TODAY, true)).toBe('cancelled')
  })

  it('sin plan se comporta como antes', () => {
    expect(trainingState([], '2026-10-30', TODAY)).toBe('none')
  })
})

describe('isoWeekday', () => {
  it('lunes es 1 y domingo es 7', () => {
    expect(isoWeekday('2026-10-26')).toBe(1)
    expect(isoWeekday('2026-10-28')).toBe(3)
    expect(isoWeekday('2026-11-01')).toBe(7)
  })
})
