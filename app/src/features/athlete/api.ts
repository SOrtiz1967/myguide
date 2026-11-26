import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { supabase } from '../../lib/supabase'
import { detectDeviceTimezone } from '../../lib/timezone'
import type {
  AthleteEquipment,
  AthleteGoal,
  EffortScale,
  ItemKind,
  Place,
  PriorityMuscle,
  UsualTime,
} from './athlete'

// Acceso a datos del perfil de atleta (spec 025). El cliente lee lo propio; escribir pasa por funciones del servidor.
// Los errores llegan como `invalid_athlete:<motivo>:<campo>` y nunca se muestran crudos.

export interface GoalsEntry {
  effective_from: string
  goals: AthleteGoal[]
  created_at: string
}

export interface AvailabilityEntry {
  effective_from: string
  days_per_week: number
  session_minutes: number | null
  usual_time: UsualTime | null
  place: Place | null
  equipment: AthleteEquipment[]
  created_at: string
}

export interface AthletePreferences {
  priority_muscles: PriorityMuscle[]
  meals_per_day: number | null
  usual_sleep_minutes: number | null
  perceived_recovery: number | null
  approx_steps: number | null
  effort_scale: EffortScale
}

export interface ItemRow {
  kind: ItemKind
  exercise_id: string | null
  food_id: string | null
  name: string
}

export interface AthleteData {
  goals: GoalsEntry[]
  availability: AvailabilityEntry[]
  preferences: AthletePreferences | null
  items: ItemRow[]
}

function athleteErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/session_expired/i.test(message)) return es.auth.sessionExpired
  const match = /invalid_athlete:([a-z_]+):([a-z_]+)/.exec(message)
  if (match) {
    const reasons = es.athlete.errors as Record<string, string | undefined>
    return reasons[match[1]!] ?? es.athlete.errors.generic
  }
  return null
}

/** Todo el perfil de atleta de la persona; el historial viene de más nuevo a más viejo. */
export async function fetchAthlete(): Promise<AthleteData> {
  const [goals, availability, preferences, items] = await Promise.all([
    supabase
      .from('athlete_goals')
      .select('effective_from, goals, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('athlete_availability')
      .select(
        'effective_from, days_per_week, session_minutes, usual_time, place, equipment, created_at',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('athlete_preferences')
      .select(
        'priority_muscles, meals_per_day, usual_sleep_minutes, perceived_recovery, approx_steps, effort_scale',
      )
      .maybeSingle(),
    supabase
      .from('athlete_item_preferences')
      .select('kind, exercise_id, food_id, exercises(name), foods(name)')
      .order('created_at', { ascending: true }),
  ])
  for (const result of [goals, availability, preferences, items]) {
    if (result.error) throw result.error
  }
  return {
    goals: (goals.data ?? []) as unknown as GoalsEntry[],
    availability: (availability.data ?? []) as unknown as AvailabilityEntry[],
    preferences: (preferences.data ?? null) as AthletePreferences | null,
    items: (items.data ?? [])
      .filter((row) => row.exercise_id !== null || row.food_id !== null)
      .map((row) => {
      const r = row as unknown as {
        kind: ItemKind
        exercise_id: string | null
        food_id: string | null
        exercises: { name: string } | null
        foods: { name: string } | null
      }
      return {
        kind: r.kind,
        exercise_id: r.exercise_id,
        food_id: r.food_id,
        name: r.exercises?.name ?? r.foods?.name ?? '',
      }
    }),
  }
}

export function saveGoals(
  input: { goals: AthleteGoal[]; effectiveFrom: string | null; applyToProfile: boolean },
  requestId: string,
): Promise<void> {
  return saveRemotely(async () => {
    const { error } = await supabase.rpc('save_athlete_goals', {
      goals: input.goals,
      effective_from: input.effectiveFrom,
      apply_to_profile: input.applyToProfile,
      request_id: requestId,
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
  }, athleteErrorMessage)
}

export function saveAvailability(
  input: {
    days: number
    minutes: number | null
    usualTime: UsualTime | null
    place: Place | null
    equipment: AthleteEquipment[]
    effectiveFrom: string | null
  },
  requestId: string,
): Promise<void> {
  return saveRemotely(async () => {
    const { error } = await supabase.rpc('save_athlete_availability', {
      days_per_week: input.days,
      session_minutes: input.minutes,
      usual_time: input.usualTime,
      place: input.place,
      equipment: input.equipment,
      effective_from: input.effectiveFrom,
      request_id: requestId,
      client_timezone: detectDeviceTimezone(),
    })
    if (error) throw error
  }, athleteErrorMessage)
}

export interface PreferencesInput {
  priority_muscles: PriorityMuscle[]
  meals_per_day: number | null
  usual_sleep_minutes: number | null
  perceived_recovery: number | null
  approx_steps: number | null
  effort_scale: EffortScale
  items: { kind: ItemKind; exercise_id?: string; food_id?: string }[]
}

export function savePreferences(input: PreferencesInput, requestId: string): Promise<void> {
  return saveRemotely(async () => {
    const { error } = await supabase.rpc('save_athlete_preferences', {
      prefs: input,
      request_id: requestId,
    })
    if (error) throw error
  }, athleteErrorMessage)
}
