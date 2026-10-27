import { describe, expect, it } from 'vitest'
import {
  ageOn,
  computePlan,
  isAdult,
  planInputFrom,
  sessionsPerWeek,
  type PlanInput,
} from '../../src/features/plan/calorie'

const base: PlanInput = {
  sex: 'male',
  ageYears: 30,
  heightCm: 175,
  weightKg: 75,
  job: 'mixed',
  experience: 'intermediate',
  goal: 'muscle_gain',
  sessionsPerWeek: 3,
  sessionsBasis: 'declared',
}

describe('computePlan', () => {
  it('ganar músculo: reposo, actividad, entrenos, mantenimiento y superávit calculados a mano', () => {
    const r = computePlan(base)
    expect(r.rmr).toBe(1699) // 10·75 + 6,25·175 − 5·30 + 5 = 1 698,75
    expect(r.baseKcal).toBe(2548) // × 1,50
    expect(r.trainingKcalPerDay).toBe(113) // (4,5 − 1) · 75 · 1 h · 3 / 7 = 112,5
    expect(r.maintenance).toBe(2660)
    expect(r.target).toBe(2930) // +10 % (intermedia) = 266 kcal
    expect(r.adjustmentPct).toBe(10)
    expect([r.low, r.high]).toEqual([2640, 3220])
    expect([r.proteinMinG, r.proteinMaxG]).toEqual([120, 165])
    expect(r.notes).toEqual([])
  })

  it('recomposición: el objetivo es el mantenimiento', () => {
    const r = computePlan({ ...base, goal: 'recomposition' })
    expect(r.target).toBe(2660)
    expect(r.adjustmentPct).toBe(0)
    expect([r.proteinMinG, r.proteinMaxG]).toEqual([135, 180])
  })

  it('perder grasa: déficit de 17 % sobre el mantenimiento', () => {
    const r = computePlan({
      sex: 'female',
      ageYears: 25,
      heightCm: 165,
      weightKg: 60,
      job: 'sedentary',
      experience: 'beginner',
      goal: 'fat_loss',
      sessionsPerWeek: 2,
      sessionsBasis: 'declared',
    })
    expect(r.maintenance).toBe(1880)
    expect(r.target).toBe(1560)
    expect(r.adjustmentPct).toBe(-17)
    expect(r.notes).toEqual([])
  })

  it('perder grasa: nunca baja del piso, y el piso no supera el mantenimiento', () => {
    const r = computePlan({
      sex: 'female',
      ageYears: 40,
      heightCm: 150,
      weightKg: 45,
      job: 'sedentary',
      experience: 'beginner',
      goal: 'fat_loss',
      sessionsPerWeek: 0,
      sessionsBasis: 'declared',
    })
    expect(r.maintenance).toBe(1390)
    expect(r.target).toBe(1200)
    expect(r.notes).toContain('floor')
    expect(r.target).toBeLessThanOrEqual(r.maintenance)
  })

  it('perder grasa con IMC menor de 18,5: se propone el mantenimiento y se avisa', () => {
    const r = computePlan({
      sex: 'female',
      ageYears: 30,
      heightCm: 170,
      weightKg: 50,
      job: 'sedentary',
      experience: 'beginner',
      goal: 'fat_loss',
      sessionsPerWeek: 0,
      sessionsBasis: 'declared',
    })
    expect(r.bmi).toBe(17.3)
    expect(r.target).toBe(r.maintenance)
    expect(r.notes).toContain('lowBmi')
  })

  it('ganar músculo: el superávit tiene tope de 500 kcal', () => {
    const r = computePlan({
      ...base,
      heightCm: 180,
      weightKg: 110,
      job: 'on_feet',
      experience: 'beginner',
      sessionsPerWeek: 7,
    })
    expect(r.maintenance).toBe(3820)
    expect(r.target).toBe(4320)
    expect(r.notes).toContain('cap')
  })

  it('a partir de los 66 años avisa que la estimación es menos precisa', () => {
    expect(computePlan({ ...base, ageYears: 70 }).notes).toContain('older')
    expect(computePlan({ ...base, ageYears: 65 }).notes).not.toContain('older')
  })

  it('es determinista', () => {
    expect(computePlan(base)).toEqual(computePlan({ ...base }))
  })
})

describe('sesiones por semana', () => {
  it('usa los días declarados con pocas sesiones registradas', () => {
    expect(sessionsPerWeek(3, 3)).toEqual({ value: 3, basis: 'declared' })
  })
  it('usa el promedio real con al menos 4 sesiones en 4 semanas, con tope de 7', () => {
    expect(sessionsPerWeek(3, 8)).toEqual({ value: 2, basis: 'logged' })
    expect(sessionsPerWeek(3, 4)).toEqual({ value: 1, basis: 'logged' })
    expect(sessionsPerWeek(3, 40)).toEqual({ value: 7, basis: 'logged' })
  })
})

describe('edad', () => {
  it('cuenta años cumplidos', () => {
    expect(ageOn('1996-10-27', '2026-10-27')).toBe(30)
    expect(ageOn('1996-10-28', '2026-10-27')).toBe(29)
    expect(isAdult('2008-10-28', '2026-10-27')).toBe(false)
    expect(isAdult('2008-10-27', '2026-10-27')).toBe(true)
  })
})

describe('planInputFrom', () => {
  const profile = {
    birth_date: '1996-01-01',
    sex: 'male' as const,
    height_cm: 175,
    job_activity: 'mixed' as const,
    training_days: 3,
    experience: 'intermediate' as const,
    goal_type: 'muscle_gain' as const,
  }

  it('arma la entrada con los datos guardados', () => {
    const r = planInputFrom(profile, 75, 0, '2026-10-27')
    expect(r.ok && r.input).toMatchObject({ ageYears: 30, weightKg: 75, sessionsPerWeek: 3 })
  })

  it('dice qué falta en lugar de suponer', () => {
    const r = planInputFrom({ ...profile, sex: null, height_cm: null }, null, 0, '2026-10-27')
    expect(r).toEqual({ ok: false, missing: ['sex', 'height', 'weight'] })
  })
})
