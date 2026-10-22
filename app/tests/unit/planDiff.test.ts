// T043 (spec 006, FR-016, FR-018, FR-019, FR-020): qué se hizo de lo planificado y en qué difiere la sesión.
import { describe, expect, it } from 'vitest'
import type { PlanItem } from '../../src/features/training/api'
import {
  doneSetsCount,
  isModified,
  planStates,
  sessionDifferences,
} from '../../src/features/training/planDiff'
import {
  emptySetInput,
  type SessionDraft,
  type SessionExerciseDraft,
} from '../../src/features/training/schema'

function plan(id: string, position: number, name: string, sets = 3): PlanItem {
  return {
    id,
    session_id: 's1',
    position,
    exercise_id: `e-${id}`,
    exercise_name: name,
    measurement_type: 'reps_weight',
    sets,
    target_reps: 8,
    target_weight_kg: 60,
    target_duration_s: null,
    target_distance_km: null,
    targets_dropped: false,
  }
}

function performed(
  id: string,
  name: string,
  setsWithValues: number,
  over: Partial<SessionExerciseDraft> = {},
): SessionExerciseDraft {
  return {
    id,
    exercise_id: `e-${id}`,
    exercise_name: name,
    measurement_type: 'reps_weight',
    plan_item_id: null,
    is_substitute: false,
    effort: '',
    note: '',
    sets: Array.from({ length: setsWithValues }, () => ({ ...emptySetInput(), reps: '5' })),
    ...over,
  }
}

const draft = (...exercises: SessionExerciseDraft[]): SessionDraft => ({ note: '', exercises })

const PLAN = [plan('p1', 1, 'Press'), plan('p2', 2, 'Remo')]

describe('doneSetsCount', () => {
  it('cuenta solo las series con algún valor', () => {
    expect(doneSetsCount(performed('x', 'A', 2))).toBe(2)
    expect(
      doneSetsCount(
        performed('x', 'A', 0, { sets: [emptySetInput(), { ...emptySetInput(), weight_kg: '0' }] }),
      ),
    ).toBe(1)
  })
})

describe('estado de cada ítem del plan', () => {
  it('«sin hacer todavía» mientras la sesión está en curso y «no realizado» al terminar', () => {
    const inProgress = planStates(PLAN, draft(), false)
    expect(inProgress.map((s) => s.status)).toEqual(['pending', 'pending'])
    const finished = planStates(PLAN, draft(), true)
    expect(finished.map((s) => s.status)).toEqual(['not_done', 'not_done'])
  })

  it('«hecho» con un ejercicio propio con series; un ejercicio sin series todavía no cuenta', () => {
    const states = planStates(
      PLAN,
      draft(
        performed('x1', 'Press', 3, { plan_item_id: 'p1' }),
        performed('x2', 'Remo', 0, { plan_item_id: 'p2' }),
      ),
      false,
    )
    expect(states.map((s) => s.status)).toEqual(['done', 'pending'])
    expect(states[0]!.own?.id).toBe('x1')
  })

  it('«sustituido» con un sustituto con series, y se sabe cuál', () => {
    const states = planStates(
      PLAN,
      draft(
        performed('x1', 'Press con mancuernas', 3, { plan_item_id: 'p1', is_substitute: true }),
      ),
      true,
    )
    expect(states[0]).toMatchObject({ status: 'substituted' })
    expect(states[0]!.substitute?.exercise_name).toBe('Press con mancuernas')
    expect(states[1]!.status).toBe('not_done')
  })
})

describe('diferencias con el plan (FR-019)', () => {
  const done = (p: string, name: string, n: number) =>
    performed(`x-${p}`, name, n, { plan_item_id: p })

  it('una sesión igual al plan no difiere, aunque cambien repeticiones, pesos o tiempos', () => {
    const d = draft(done('p1', 'Press', 3), done('p2', 'Remo', 3))
    expect(sessionDifferences(PLAN, d)).toEqual([])
    expect(isModified(PLAN, d)).toBe(false)
  })

  it('un ítem sin hacer', () => {
    const d = draft(done('p1', 'Press', 3))
    expect(sessionDifferences(PLAN, d)).toEqual([{ kind: 'not_done', name: 'Remo' }])
    expect(isModified(PLAN, d)).toBe(true)
  })

  it('un ejercicio con cero series equivale a no realizado', () => {
    const d = draft(done('p1', 'Press', 3), done('p2', 'Remo', 0))
    expect(sessionDifferences(PLAN, d)).toEqual([{ kind: 'not_done', name: 'Remo' }])
  })

  it('un sustituto', () => {
    const d = draft(
      done('p1', 'Press', 3),
      performed('x-sub', 'Remo con barra', 3, { plan_item_id: 'p2', is_substitute: true }),
    )
    expect(sessionDifferences(PLAN, d)).toEqual([
      { kind: 'substituted', planned: 'Remo', done: 'Remo con barra' },
    ])
  })

  it('un ejercicio agregado cuenta si tiene series y no si está vacío', () => {
    const base = [done('p1', 'Press', 3), done('p2', 'Remo', 3)]
    expect(sessionDifferences(PLAN, draft(...base, performed('add', 'Curl', 0)))).toEqual([])
    expect(sessionDifferences(PLAN, draft(...base, performed('add', 'Curl', 2)))).toEqual([
      { kind: 'added', name: 'Curl' },
    ])
  })

  it('otra cantidad de series, con más o con menos', () => {
    expect(sessionDifferences(PLAN, draft(done('p1', 'Press', 2), done('p2', 'Remo', 3)))).toEqual([
      { kind: 'sets', name: 'Press', planned: 3, done: 2 },
    ])
    expect(sessionDifferences(PLAN, draft(done('p1', 'Press', 3), done('p2', 'Remo', 4)))).toEqual([
      { kind: 'sets', name: 'Remo', planned: 3, done: 4 },
    ])
  })

  it('sin plan nunca hay diferencias', () => {
    const d = draft(performed('add', 'Curl', 3))
    expect(sessionDifferences([], d)).toEqual([])
    expect(isModified([], d)).toBe(false)
  })
})
