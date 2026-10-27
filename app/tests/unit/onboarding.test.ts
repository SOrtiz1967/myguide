import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import {
  EMPTY_VALUES,
  onboardingErrorMessage,
  planInputOf,
  toProfileUpdate,
  validateStep,
  type OnboardingValues,
} from '../../src/features/onboarding/onboarding'
import { findTrainingForbidden } from '../support/trainingForbiddenTerms'

const today = '2026-10-27'
const e = es.onboarding.errors

const valid: OnboardingValues = {
  sex: 'male',
  birthDate: '1996-01-01',
  heightCm: '175',
  weightKg: '75,5',
  job: 'mixed',
  trainingDays: '3',
  experience: 'intermediate',
  goal: 'muscle_gain',
}

describe('validateStep', () => {
  it('paso 1: pide sexo, nacimiento, altura y peso', () => {
    expect(Object.keys(validateStep(1, EMPTY_VALUES, today)).sort()).toEqual([
      'birthDate',
      'heightCm',
      'sex',
      'weightKg',
    ])
    expect(validateStep(1, valid, today)).toEqual({})
  })

  it('paso 1: rechaza a una persona menor de 18 años y fechas imposibles', () => {
    expect(validateStep(1, { ...valid, birthDate: '2008-10-28' }, today).birthDate).toBe(e.underage)
    expect(validateStep(1, { ...valid, birthDate: '2008-10-27' }, today)).toEqual({})
    expect(validateStep(1, { ...valid, birthDate: '2030-01-01' }, today).birthDate).toBe(
      e.birthDate,
    )
    expect(validateStep(1, { ...valid, birthDate: '1800-01-01' }, today).birthDate).toBe(
      e.birthDate,
    )
  })

  it('paso 1: altura entre 50 y 250 cm y peso dentro del rango de Medidas', () => {
    expect(validateStep(1, { ...valid, heightCm: '49' }, today).heightCm).toBe(e.height)
    expect(validateStep(1, { ...valid, heightCm: '171,5' }, today)).toEqual({})
    expect(validateStep(1, { ...valid, weightKg: '5' }, today).weightKg).toBeTruthy()
    expect(validateStep(1, { ...valid, weightKg: 'abc' }, today).weightKg).toBeTruthy()
  })

  it('paso 2: trabajo, días entre 0 y 7 y experiencia', () => {
    expect(Object.keys(validateStep(2, EMPTY_VALUES, today)).sort()).toEqual([
      'experience',
      'job',
      'trainingDays',
    ])
    expect(validateStep(2, { ...valid, trainingDays: '0' }, today)).toEqual({})
    expect(validateStep(2, { ...valid, trainingDays: '8' }, today).trainingDays).toBe(e.days)
    expect(validateStep(2, valid, today)).toEqual({})
  })

  it('paso 3: pide un objetivo', () => {
    expect(validateStep(3, EMPTY_VALUES, today).goal).toBe(e.goal)
    expect(validateStep(3, valid, today)).toEqual({})
  })
})

describe('planInputOf y toProfileUpdate', () => {
  it('arma la entrada del cálculo con lo escrito', () => {
    expect(planInputOf(valid, today)).toEqual({
      sex: 'male',
      ageYears: 30,
      heightCm: 175,
      weightKg: 75.5,
      job: 'mixed',
      experience: 'intermediate',
      goal: 'muscle_gain',
      sessionsPerWeek: 3,
      sessionsBasis: 'declared',
    })
    expect(planInputOf({ ...valid, goal: '' }, today)).toBeNull()
  })

  it('arma lo que se guarda en el perfil, con la marca de completado', () => {
    expect(
      toProfileUpdate(valid, 'America/Argentina/Buenos_Aires', '2026-10-27T10:00:00Z'),
    ).toEqual({
      birth_date: '1996-01-01',
      sex: 'male',
      height_cm: 175,
      timezone: 'America/Argentina/Buenos_Aires',
      goal_type: 'muscle_gain',
      experience: 'intermediate',
      job_activity: 'mixed',
      training_days: 3,
      onboarding_completed_at: '2026-10-27T10:00:00Z',
    })
  })
})

describe('errores del servidor y lenguaje', () => {
  it('traduce solo los errores conocidos', () => {
    expect(onboardingErrorMessage({ message: 'invalid_onboarding:underage: x' })).toBe(e.underage)
    expect(onboardingErrorMessage({ message: 'invalid_onboarding:incomplete: x' })).toBe(
      e.incomplete,
    )
    expect(onboardingErrorMessage({ message: 'session_expired: x' })).toBe(es.auth.sessionExpired)
    expect(onboardingErrorMessage({ message: 'otra cosa' })).toBeNull()
  })

  it('los textos del recorrido, del plan y del perfil no usan términos prohibidos', () => {
    const texts: string[] = []
    const walk = (node: unknown) => {
      if (typeof node === 'string') texts.push(node)
      else if (typeof node === 'function') {
        const fn = node as (...args: unknown[]) => unknown
        const result = fn(...Array(Math.max(fn.length, 1)).fill(3))
        if (typeof result === 'string') texts.push(result)
      } else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(es.onboarding)
    walk(es.plan)
    walk(es.profile.goalForm)
    expect(texts.length).toBeGreaterThan(60)
    expect(texts.flatMap((text) => findTrainingForbidden(text))).toEqual([])
  })
})
