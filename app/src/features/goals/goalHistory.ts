/**
 * Resolución del objetivo de energía diaria a partir del historial de cambios (spec 004).
 *
 * El historial es de solo altas: cada cambio (o el quitar el objetivo) es una fila. El objetivo de un
 * día es el del cambio guardado más recientemente entre los que ya regían ese día. Así cambiar el
 * objetivo nunca reescribe lo que regía en un día pasado (Principio II, FR-008).
 */

export interface GoalChange {
  /** Día (`AAAA-MM-DD`, zona de la persona) desde el que rige el cambio. */
  effective_from: string
  /** Kilocalorías por día; `null` = la persona quitó el objetivo. */
  kcal: number | null
  /** Cuándo se guardó el cambio; define cuál es el último. */
  created_at: string
}

export interface CurrentGoal {
  kcal: number
  /** Día desde el que rige este valor (no se mueve si se guardó el mismo valor otra vez). */
  since: string
}

/** Los cambios que ya regían en `day`, del más viejo al más reciente por `created_at`. */
function appliedUpTo(history: readonly GoalChange[], day: string): GoalChange[] {
  return history
    .filter((change) => change.effective_from <= day)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
}

/** El objetivo (kcal) que regía en `day`, o `null` si ese día no tenía objetivo. */
export function goalOn(history: readonly GoalChange[], day: string): number | null {
  return appliedUpTo(history, day).at(-1)?.kcal ?? null
}

/** El objetivo vigente hoy con la fecha desde la que rige, o `null` si no hay objetivo. */
export function currentGoal(history: readonly GoalChange[], today: string): CurrentGoal | null {
  const applied = appliedUpTo(history, today)
  const last = applied.at(-1)
  if (!last || last.kcal === null) return null

  let start = applied.length - 1
  while (start > 0 && applied[start - 1]!.kcal === last.kcal) start -= 1
  return { kcal: last.kcal, since: applied[start]!.effective_from }
}
