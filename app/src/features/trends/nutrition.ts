// Spec 010 (FR-004 a FR-010): alimentación por semana. Funciones puras sobre los totales diarios que entrega
// `trends_nutrition`. Un dato que falta nunca es cero: el día queda fuera de ese promedio y se dice cuántos días lo usaron.
import { goalOn, type GoalChange } from '../goals/goalHistory'
import { TOLERANCE } from '../week/week'
import { weekOf, type Week } from './weeks'

/** Una fila de `trends_nutrition`: lo confirmado de un día, con cuántas entradas informan cada nutriente. */
export interface DayNutrition {
  log_date: string
  entries: number
  energy_kcal: number | null
  energy_count: number
  protein_g: number | null
  protein_count: number
  carbs_g: number | null
  carbs_count: number
  fat_g: number | null
  fat_count: number
}

export const NUTRIENT_KEYS = ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'] as const
export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

const COUNT_OF: Record<
  NutrientKey,
  'energy_count' | 'protein_count' | 'carbs_count' | 'fat_count'
> = {
  energy_kcal: 'energy_count',
  protein_g: 'protein_count',
  carbs_g: 'carbs_count',
  fat_g: 'fat_count',
}

/** Quita el error de punto flotante de una suma de decimales. */
const clean = (value: number) => Math.round(value * 1e6) / 1e6

/** El promedio por día de un nutriente y con cuántos días se calculó. */
export interface Average {
  /** Nulo si ningún día de la semana lo informa. */
  value: number | null
  days: number
}

export interface NutritionWeek {
  week: Week
  /** Días con al menos una entrada confirmada con calorías. */
  recordedDays: number
  averages: Record<NutrientKey, Average>
  /** Objetivos distintos que regían en los días con registro, de menor a mayor; vacío si no había objetivo. */
  goals: number[]
  /** Días con registro y con objetivo ese día: la base del conteo del rango. */
  daysWithGoal: number
  /** De esos, los que estuvieron dentro de 10 % por encima o por debajo del objetivo de ese día. */
  daysInRange: number
}

const hasRecord = (day: DayNutrition) => day.energy_count > 0 && day.energy_kcal !== null

/** `kcal` está dentro de más o menos 10 % de `goal` (límites incluidos). */
export function inGoalRange(kcal: number, goal: number): boolean {
  const margin = goal * TOLERANCE
  return kcal >= goal - margin - 1e-9 && kcal <= goal + margin + 1e-9
}

function average(days: readonly DayNutrition[], key: NutrientKey): Average {
  const informed = days.filter((day) => day[COUNT_OF[key]] > 0 && day[key] !== null)
  if (informed.length === 0) return { value: null, days: 0 }
  const sum = informed.reduce((total, day) => total + (day[key] as number), 0)
  return { value: clean(sum / informed.length), days: informed.length }
}

/** Una fila por semana del período, de la más antigua a la en curso. */
export function buildNutritionWeeks(
  days: readonly DayNutrition[],
  weeks: readonly Week[],
  goalHistory: readonly GoalChange[],
): NutritionWeek[] {
  return weeks.map((week) => {
    const inWeek = days.filter((day) => weekOf([week], day.log_date) !== undefined)
    const recorded = inWeek.filter(hasRecord)
    const goals = new Set<number>()
    let daysWithGoal = 0
    let daysInRange = 0
    for (const day of recorded) {
      const goal = goalOn(goalHistory, day.log_date)
      if (goal === null) continue
      goals.add(goal)
      daysWithGoal++
      if (inGoalRange(day.energy_kcal as number, goal)) daysInRange++
    }
    return {
      week,
      recordedDays: recorded.length,
      averages: {
        energy_kcal: average(recorded, 'energy_kcal'),
        protein_g: average(inWeek, 'protein_g'),
        carbs_g: average(inWeek, 'carbs_g'),
        fat_g: average(inWeek, 'fat_g'),
      },
      goals: [...goals].sort((a, b) => a - b),
      daysWithGoal,
      daysInRange,
    }
  })
}

export interface WeightPoint {
  date: string
  value: number
}

export interface ProteinPerKg {
  /** g de proteína por kg; nulo si falta la proteína o el peso. */
  value: number | null
  /** Promedio de proteína por día y con cuántos días se calculó. */
  protein: Average
  /** El último peso registrado hasta el final del período, con su fecha. */
  weight: WeightPoint | null
}

/** Proteína por kilo: el promedio del período sobre el último peso registrado hasta el final (nunca un peso estimado). */
export function proteinPerKg(
  days: readonly DayNutrition[],
  weights: readonly WeightPoint[],
  to: string,
): ProteinPerKg {
  const protein = average(days, 'protein_g')
  const weight =
    [...weights]
      .filter((point) => point.date <= to)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .at(-1) ?? null
  const value =
    protein.value === null || weight === null ? null : clean(protein.value / weight.value)
  return { value, protein, weight }
}
