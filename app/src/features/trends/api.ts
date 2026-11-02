// Spec 010: lecturas de Tendencias. Solo lee; no guarda ni corrige nada. Contrato: specs/010-tendencias-correlaciones/contracts.
import { supabase } from '../../lib/supabase'
import { fetchWeightsBetween } from '../measures/api'
import type { DayNutrition, WeightPoint } from './nutrition'
import type { SleepRecord } from './sleep'
import type { TrainingWeekRow } from './training'

const numberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value)

/** Los totales diarios de lo confirmado entre dos días (ambos incluidos). Los `numeric` llegan como texto o número. */
export async function fetchNutritionDays(from: string, to: string): Promise<DayNutrition[]> {
  const { data, error } = await supabase.rpc('trends_nutrition', { from_date: from, to_date: to })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    log_date: row.log_date as string,
    entries: Number(row.entries),
    energy_kcal: numberOrNull(row.energy_kcal),
    energy_count: Number(row.energy_count),
    protein_g: numberOrNull(row.protein_g),
    protein_count: Number(row.protein_count),
    carbs_g: numberOrNull(row.carbs_g),
    carbs_count: Number(row.carbs_count),
    fat_g: numberOrNull(row.fat_g),
    fat_count: Number(row.fat_count),
  }))
}

/** Las series de sesiones realizadas por semana y grupo muscular entre dos días. */
export async function fetchTrainingSets(from: string, to: string): Promise<TrainingWeekRow[]> {
  const { data, error } = await supabase.rpc('trends_training_sets', {
    from_date: from,
    to_date: to,
  })
  if (error) throw error
  return (data ?? []) as unknown as TrainingWeekRow[]
}

/** Los pesos registrados entre dos días, del más antiguo al más reciente. */
export async function fetchWeights(from: string, to: string): Promise<WeightPoint[]> {
  const rows = await fetchWeightsBetween(from, to)
  return rows.map((row) => ({ date: row.measured_on, value: row.value }))
}

/** El último peso registrado hasta un día (para la proteína por kilo), o nulo. */
export async function fetchWeightUpTo(to: string): Promise<WeightPoint | null> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('measured_on, value')
    .eq('kind', 'weight')
    .lte('measured_on', to)
    .order('measured_on', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = data?.[0]
  return row ? { date: row.measured_on as string, value: Number(row.value) } : null
}

/** Las noches de sueño registradas entre dos días (en minutos). */
export async function fetchSleepBetween(from: string, to: string): Promise<SleepRecord[]> {
  const { data, error } = await supabase
    .from('daily_activity')
    .select('activity_date, value')
    .eq('kind', 'sleep')
    .gte('activity_date', from)
    .lte('activity_date', to)
    .order('activity_date', { ascending: true })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map((row) => ({
    activity_date: row.activity_date as string,
    value: Number(row.value),
  }))
}
