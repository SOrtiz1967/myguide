import { z } from 'zod'
import { es } from '../../copy/es'
import { ageOn, isAdult, type PlanInput } from '../plan/calorie'
import { isReasonableBirthDate, parseHeight } from '../profile/schema'
import type { Experience, GoalType, JobActivity, ProfileUpdate } from '../profile/api'
import { parseMeasure } from '../measures/measures'

// Datos del primer ingreso (spec 014). Todo se escribe como texto y se valida por paso; el servidor
// vuelve a imponer las reglas al completar el recorrido.

export interface OnboardingValues {
  sex: '' | 'female' | 'male'
  birthDate: string
  heightCm: string
  weightKg: string
  job: '' | JobActivity
  trainingDays: string
  experience: '' | Experience
  goal: '' | GoalType
}

export const EMPTY_VALUES: OnboardingValues = {
  sex: '',
  birthDate: '',
  heightCm: '',
  weightKg: '',
  job: '',
  trainingDays: '',
  experience: '',
  goal: '',
}

/** Forma del borrador local: solo texto, sin reglas (puede estar a medio escribir). */
export const draftSchema = z.object({
  sex: z.string(),
  birthDate: z.string(),
  heightCm: z.string(),
  weightKg: z.string(),
  job: z.string(),
  trainingDays: z.string(),
  experience: z.string(),
  goal: z.string(),
})

export const TOTAL_STEPS = 4
export type Step = 1 | 2 | 3 | 4
export type StepErrors = Partial<Record<keyof OnboardingValues, string>>

const e = es.onboarding.errors

const JOBS: readonly string[] = ['sedentary', 'mixed', 'on_feet']
const EXPERIENCES: readonly string[] = ['beginner', 'intermediate', 'advanced']
const GOALS: readonly string[] = ['muscle_gain', 'fat_loss', 'recomposition']

export function validateStep(step: Step, v: OnboardingValues, today: string): StepErrors {
  const errors: StepErrors = {}
  if (step === 1) {
    if (v.sex !== 'female' && v.sex !== 'male') errors.sex = e.sex
    if (!isReasonableBirthDate(v.birthDate)) errors.birthDate = e.birthDate
    else if (!isAdult(v.birthDate, today)) errors.birthDate = e.underage
    if (parseHeight(v.heightCm) === null) errors.heightCm = e.height
    const weight = parseMeasure('weight', v.weightKg)
    if (typeof weight === 'string') errors.weightKg = weight
  } else if (step === 2) {
    if (!JOBS.includes(v.job)) errors.job = e.job
    if (!/^[0-7]$/.test(v.trainingDays)) errors.trainingDays = e.days
    if (!EXPERIENCES.includes(v.experience)) errors.experience = e.experience
  } else if (step === 3) {
    if (!GOALS.includes(v.goal)) errors.goal = e.goal
  }
  return errors
}

/** La entrada del cálculo calórico con lo escrito; nulo si algo no es válido todavía. */
export function planInputOf(v: OnboardingValues, today: string): PlanInput | null {
  const weight = parseMeasure('weight', v.weightKg)
  const height = parseHeight(v.heightCm)
  if (
    (v.sex !== 'female' && v.sex !== 'male') ||
    !isReasonableBirthDate(v.birthDate) ||
    height === null ||
    typeof weight === 'string' ||
    v.job === '' ||
    v.experience === '' ||
    v.goal === '' ||
    !/^[0-7]$/.test(v.trainingDays)
  ) {
    return null
  }
  return {
    sex: v.sex,
    ageYears: ageOn(v.birthDate, today),
    heightCm: height,
    weightKg: weight,
    job: v.job,
    experience: v.experience,
    goal: v.goal,
    sessionsPerWeek: Number(v.trainingDays),
    sessionsBasis: 'declared',
  }
}

/** Lo que se guarda en el perfil al completar el recorrido. */
export function toProfileUpdate(
  v: OnboardingValues,
  timezone: string,
  completedAt: string,
): ProfileUpdate {
  return {
    birth_date: v.birthDate,
    sex: v.sex === '' ? null : v.sex,
    height_cm: parseHeight(v.heightCm),
    timezone,
    goal_type: v.goal === '' ? null : v.goal,
    experience: v.experience === '' ? null : v.experience,
    job_activity: v.job === '' ? null : v.job,
    training_days: Number(v.trainingDays),
    onboarding_completed_at: completedAt,
  }
}

/** Mensaje seguro para los errores conocidos del servidor al completar el recorrido. */
export function onboardingErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  const match = /invalid_onboarding:([a-z]+)/.exec(message)
  if (match) return e[match[1]!] ?? null
  return null
}
