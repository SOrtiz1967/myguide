// Perfil de atleta (spec 025): tipos y reglas puras, sin acceso a datos.

export const GOAL_KINDS = [
  'hypertrophy',
  'strength',
  'gradual_fat_loss',
  'maintenance',
  'recomposition',
  'performance',
  'fitness',
  'custom',
] as const
export type GoalKind = (typeof GOAL_KINDS)[number]

export interface AthleteGoal {
  kind: GoalKind
  priority: 1 | 2 | 3
  label?: string
}

export const MAX_GOALS = 3
export const MAX_CUSTOM_LABEL = 60

export const USUAL_TIMES = ['morning', 'afternoon', 'evening', 'varies'] as const
export type UsualTime = (typeof USUAL_TIMES)[number]
export const PLACES = ['gym', 'home', 'other'] as const
export type Place = (typeof PLACES)[number]
export const EQUIPMENT = [
  'barbell',
  'dumbbells',
  'machines',
  'cables',
  'bodyweight',
  'bands',
  'kettlebell',
  'bench',
  'rack',
  'cardio',
] as const
export type AthleteEquipment = (typeof EQUIPMENT)[number]

export const PRIORITY_MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
] as const
export type PriorityMuscle = (typeof PRIORITY_MUSCLES)[number]
export const MAX_PRIORITY_MUSCLES = 5

export type EffortScale = 'rir' | 'rpe'
export type ItemKind = 'exercise_favorite' | 'exercise_avoided' | 'food_avoided'

export interface ItemPreference {
  kind: ItemKind
  id: string
  name: string
}

/** El objetivo de la spec 014 que corresponde a un objetivo nuevo, o `null` si no tiene equivalente. */
export function profileGoalFor(
  kind: GoalKind,
): 'muscle_gain' | 'fat_loss' | 'recomposition' | null {
  if (kind === 'hypertrophy') return 'muscle_gain'
  if (kind === 'gradual_fat_loss') return 'fat_loss'
  if (kind === 'recomposition') return 'recomposition'
  return null
}

/** El objetivo de prioridad 1 de una lista, si existe. */
export function topGoal(goals: readonly AthleteGoal[]): AthleteGoal | null {
  return goals.find((goal) => goal.priority === 1) ?? null
}

export type GoalsProblem =
  'empty' | 'too_many' | 'repeated_kind' | 'repeated_priority' | 'label_required' | 'label_too_long'

/** Valida la lista de objetivos antes de enviarla; el servidor repite las mismas reglas. */
export function validateGoals(goals: readonly AthleteGoal[]): GoalsProblem | null {
  if (goals.length === 0) return 'empty'
  if (goals.length > MAX_GOALS) return 'too_many'
  const kinds = new Set<GoalKind>()
  const priorities = new Set<number>()
  for (const goal of goals) {
    if (goal.kind !== 'custom' && kinds.has(goal.kind)) return 'repeated_kind'
    kinds.add(goal.kind)
    if (priorities.has(goal.priority)) return 'repeated_priority'
    priorities.add(goal.priority)
    if (goal.kind === 'custom') {
      const label = goal.label?.trim() ?? ''
      if (label === '') return 'label_required'
      if (label.length > MAX_CUSTOM_LABEL) return 'label_too_long'
    }
  }
  return null
}

/** Reasigna las prioridades 1..n según el orden de la lista (el primero es el principal). */
export function withPriorities(
  kinds: readonly { kind: GoalKind; label?: string }[],
): AthleteGoal[] {
  return kinds.map((goal, index) => ({
    kind: goal.kind,
    priority: (index + 1) as 1 | 2 | 3,
    ...(goal.kind === 'custom' ? { label: goal.label?.trim() ?? '' } : {}),
  }))
}

/** Valor vigente de un historial ordenado de más nuevo a más viejo: el primero con vigencia ya iniciada. */
export function currentEntry<T extends { effective_from: string }>(
  rows: readonly T[],
  today: string,
): T | null {
  return rows.find((row) => row.effective_from <= today) ?? null
}

/** Minutos de sueño habituales → horas con un decimal para mostrar («7,5 h»); `null` si no hay dato. */
export function sleepHours(minutes: number | null): number | null {
  return minutes === null ? null : Math.round((minutes / 60) * 10) / 10
}

export interface AvailabilityValues {
  days_per_week: number
  session_minutes: number | null
  usual_time: UsualTime | null
  place: Place | null
  equipment: AthleteEquipment[]
}

export type AvailabilityProblem = 'days' | 'minutes' | 'equipment'

export function validateAvailability(values: AvailabilityValues): AvailabilityProblem | null {
  if (
    !Number.isInteger(values.days_per_week) ||
    values.days_per_week < 1 ||
    values.days_per_week > 7
  ) {
    return 'days'
  }
  if (
    values.session_minutes !== null &&
    (!Number.isInteger(values.session_minutes) ||
      values.session_minutes < 15 ||
      values.session_minutes > 240)
  ) {
    return 'minutes'
  }
  if (values.equipment.length > 10) return 'equipment'
  return null
}
