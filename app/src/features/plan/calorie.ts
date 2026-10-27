import type { Experience, GoalType, JobActivity, Profile } from '../profile/api'

// Cálculo del objetivo calórico (spec 015). Puro y determinista: la misma entrada da siempre el mismo
// resultado. Es una estimación aproximada con un método documentado en research_notes (Principio V).

export type Sex = 'female' | 'male'
export type SessionsBasis = 'declared' | 'logged'
export type PlanNote = 'floor' | 'lowBmi' | 'older' | 'cap'

export interface PlanInput {
  sex: Sex
  ageYears: number
  heightCm: number
  weightKg: number
  job: JobActivity
  experience: Experience
  goal: GoalType
  /** Sesiones de entrenamiento por semana y de dónde sale ese número. */
  sessionsPerWeek: number
  sessionsBasis: SessionsBasis
}

export interface PlanResult {
  /** Metabolismo en reposo (Mifflin-St Jeor). */
  rmr: number
  baseFactor: number
  /** Reposo por el factor de actividad diaria, sin entrenamiento estructurado. */
  baseKcal: number
  /** Gasto promedio diario de las sesiones de entrenamiento. */
  trainingKcalPerDay: number
  maintenance: number
  /** Ajuste real aplicado sobre el mantenimiento, en porcentaje entero (puede ser negativo). */
  adjustmentPct: number
  target: number
  low: number
  high: number
  proteinMinG: number
  proteinMaxG: number
  bmi: number
  notes: PlanNote[]
}

export const BASE_FACTOR: Record<JobActivity, number> = {
  sedentary: 1.35,
  mixed: 1.5,
  on_feet: 1.65,
}
const GAIN_PCT: Record<Experience, number> = { beginner: 0.15, intermediate: 0.1, advanced: 0.07 }
const GAIN_CAP_KCAL = 500
const LOSS_PCT = 0.17
/** MET promedio del entrenamiento de fuerza (el Compendio da entre 3,5 y 6,0) y duración supuesta. */
export const TRAINING_MET = 4.5
export const SESSION_HOURS = 1
export const FLOOR_KCAL: Record<Sex, number> = { female: 1200, male: 1500 }
const MIN_BMI_FOR_DEFICIT = 18.5
const ADULT_AGE = 18
const OLDER_AGE = 65
/** Sesiones realizadas en 4 semanas desde las que se usa el promedio real en lugar de lo declarado. */
export const MIN_LOGGED_SESSIONS = 4
export const LOGGED_WINDOW_WEEKS = 4

const round10 = (value: number) => Math.round(value / 10) * 10

/** La edad cumplida en `today` (ambas fechas ISO AAAA-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number]
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number]
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

export const isAdult = (birthDate: string, today: string) => ageOn(birthDate, today) >= ADULT_AGE

/**
 * Sesiones por semana: el promedio real de las últimas 4 semanas si hay al menos `MIN_LOGGED_SESSIONS`
 * sesiones realizadas; si no, los días que la persona indicó.
 */
export function sessionsPerWeek(
  declaredDays: number,
  completedLast28Days: number,
): { value: number; basis: SessionsBasis } {
  if (completedLast28Days >= MIN_LOGGED_SESSIONS) {
    const average = Math.min(7, completedLast28Days / LOGGED_WINDOW_WEEKS)
    return { value: Math.round(average * 10) / 10, basis: 'logged' }
  }
  return { value: declaredDays, basis: 'declared' }
}

export function computePlan(input: PlanInput): PlanResult {
  const { sex, ageYears, heightCm, weightKg } = input
  const rmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161)
  const baseFactor = BASE_FACTOR[input.job]
  const baseKcal = rmr * baseFactor
  const trainingKcalPerDay =
    ((TRAINING_MET - 1) * weightKg * SESSION_HOURS * input.sessionsPerWeek) / 7
  const maintenance = round10(baseKcal + trainingKcalPerDay)
  const bmi = weightKg / (heightCm / 100) ** 2
  const notes: PlanNote[] = []

  let target = maintenance
  if (input.goal === 'muscle_gain') {
    const surplus = maintenance * GAIN_PCT[input.experience]
    if (surplus > GAIN_CAP_KCAL) notes.push('cap')
    target = maintenance + Math.min(surplus, GAIN_CAP_KCAL)
  } else if (input.goal === 'fat_loss') {
    if (bmi < MIN_BMI_FOR_DEFICIT) {
      notes.push('lowBmi')
    } else {
      target = maintenance * (1 - LOSS_PCT)
      // El piso nunca se aplica por encima del mantenimiento: no convierte un déficit en superávit.
      const floor = Math.min(FLOOR_KCAL[sex], maintenance)
      if (target < floor) {
        target = floor
        notes.push('floor')
      }
    }
  }
  target = round10(target)
  if (ageYears > OLDER_AGE) notes.push('older')

  const protein = input.goal === 'muscle_gain' ? { min: 1.6, max: 2.2 } : { min: 1.8, max: 2.4 }
  return {
    rmr: Math.round(rmr),
    baseFactor,
    baseKcal: Math.round(baseKcal),
    trainingKcalPerDay: Math.round(trainingKcalPerDay),
    maintenance,
    adjustmentPct: Math.round((target / maintenance - 1) * 100),
    target,
    low: round10(target * 0.9),
    high: round10(target * 1.1),
    proteinMinG: Math.round((protein.min * weightKg) / 5) * 5,
    proteinMaxG: Math.round((protein.max * weightKg) / 5) * 5,
    bmi: Math.round(bmi * 10) / 10,
    notes,
  }
}

export type MissingField =
  'birthDate' | 'sex' | 'height' | 'weight' | 'job' | 'trainingDays' | 'experience' | 'goal'

/**
 * Arma la entrada del cálculo con lo que hay guardado. Si falta algo, devuelve qué falta en lugar de
 * inventar un valor (Principio V: un dato faltante no se completa con supuestos).
 */
export function planInputFrom(
  profile: Pick<
    Profile,
    | 'birth_date'
    | 'sex'
    | 'height_cm'
    | 'job_activity'
    | 'training_days'
    | 'experience'
    | 'goal_type'
  >,
  weightKg: number | null,
  completedLast28Days: number,
  today: string,
): { ok: true; input: PlanInput } | { ok: false; missing: MissingField[] } {
  const missing: MissingField[] = []
  if (!profile.birth_date) missing.push('birthDate')
  if (!profile.sex) missing.push('sex')
  if (profile.height_cm === null) missing.push('height')
  if (weightKg === null) missing.push('weight')
  if (!profile.job_activity) missing.push('job')
  if (profile.training_days === null) missing.push('trainingDays')
  if (!profile.experience) missing.push('experience')
  if (!profile.goal_type) missing.push('goal')
  if (
    missing.length > 0 ||
    !profile.birth_date ||
    !profile.sex ||
    profile.height_cm === null ||
    weightKg === null ||
    !profile.job_activity ||
    profile.training_days === null ||
    !profile.experience ||
    !profile.goal_type
  ) {
    return { ok: false, missing }
  }
  const sessions = sessionsPerWeek(profile.training_days, completedLast28Days)
  return {
    ok: true,
    input: {
      sex: profile.sex,
      ageYears: ageOn(profile.birth_date, today),
      heightCm: Number(profile.height_cm),
      weightKg,
      job: profile.job_activity,
      experience: profile.experience,
      goal: profile.goal_type,
      sessionsPerWeek: sessions.value,
      sessionsBasis: sessions.basis,
    },
  }
}
