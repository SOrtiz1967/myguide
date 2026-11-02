// Spec 010 (FR-017 a FR-019): series registradas por semana y grupo muscular principal, sin fraccionar ni comparar con
// rangos recomendados. Los datos vienen de `trends_training_sets`, que ya cuenta cada serie en cada músculo principal.
import { weekOf, type Week } from './weeks'

/** Una fila de `trends_training_sets`. */
export interface TrainingWeekRow {
  week_start: string
  total_sets: number
  by_muscle: Record<string, number> | null
}

/** «Todos los grupos»: cada serie cuenta una sola vez. */
export const ALL_GROUPS = 'all'
/** Series de ejercicios sin músculo principal o que ya no están en el catálogo. */
export const NO_GROUP = 'sin_grupo'

export interface TrainingWeek {
  week: Week
  sets: number
}

/** Una fila por semana; las semanas sin series tienen cero series registradas. */
export function buildTrainingWeeks(
  rows: readonly TrainingWeekRow[],
  weeks: readonly Week[],
  group: string,
): TrainingWeek[] {
  return weeks.map((week) => {
    const row = rows.find((candidate) => weekOf([week], candidate.week_start) !== undefined)
    if (!row) return { week, sets: 0 }
    return { week, sets: group === ALL_GROUPS ? row.total_sets : (row.by_muscle?.[group] ?? 0) }
  })
}

/** Los grupos con series en las semanas dadas, de más a menos series y, a igualdad, por clave. */
export function availableGroups(
  rows: readonly TrainingWeekRow[],
  weeks: readonly Week[],
): { group: string; sets: number }[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (weekOf(weeks, row.week_start) === undefined) continue
    for (const [group, sets] of Object.entries(row.by_muscle ?? {})) {
      totals.set(group, (totals.get(group) ?? 0) + sets)
    }
  }
  return [...totals.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group))
}
