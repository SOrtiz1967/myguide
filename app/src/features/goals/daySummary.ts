import type { MealEntry } from '../meals/api'
import { sumEntries } from '../meals/mealTotals'

/** Lo único que el resumen necesita de cada ítem del día. */
export type SummaryEntry = Pick<MealEntry, 'energy_kcal' | 'status'>

interface Base {
  /** Suma de la energía de los ítems con dato, redondeada una vez a kcal enteras. */
  registered: number
  /** La parte de `registered` que viene de estimaciones todavía sin confirmar. */
  pending: number
  /** Cuántos ítems no tienen dato de energía (un 0 es dato). */
  missing: number
  /** Hay ítems sin dato: `registered` es un mínimo y lo que resta, un máximo. */
  lowerBound: boolean
}

export interface NoGoalSummary extends Base {
  state: 'none'
}

export interface GoalSummary extends Base {
  state: 'under' | 'met' | 'over'
  goal: number
  /** `goal − registered`; negativo si se superó. */
  remaining: number
  /** `registered − goal`; solo cuando se superó. */
  difference?: number
  /** `round(registered / goal × 100)`. */
  percent: number
}

export type DaySummary = NoGoalSummary | GoalSummary

const energyOf = (entries: readonly SummaryEntry[]) =>
  Math.round(
    sumEntries(
      entries.map((e) => ({
        energy_kcal: e.energy_kcal,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      })),
    ).energy_kcal.value ?? 0,
  )

/**
 * Resumen del día (spec 004, FR-012 a FR-017, FR-021). Se calcula sobre los ítems que la vista del día
 * ya trae y el objetivo que regía ese día. Sin objetivo, ningún campo del objetivo existe en el
 * resultado: la interfaz no puede mostrar restantes, porcentaje ni barra por descuido (FR-002).
 */
export function summarizeDay(entries: readonly SummaryEntry[], goal?: number | null): DaySummary {
  const registered = energyOf(entries)
  const pending = energyOf(entries.filter((e) => e.status === 'pending'))
  const missing = entries.filter((e) => e.energy_kcal === null).length
  const base: Base = { registered, pending, missing, lowerBound: missing > 0 }

  if (goal === null || goal === undefined) return { state: 'none', ...base }

  const remaining = goal - registered
  const state = remaining > 0 ? 'under' : remaining === 0 ? 'met' : 'over'
  const summary: GoalSummary = {
    state,
    ...base,
    goal,
    remaining,
    percent: Math.round((registered / goal) * 100),
  }
  if (state === 'over') summary.difference = -remaining
  return summary
}
