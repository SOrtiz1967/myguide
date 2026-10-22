import type { PlanItem } from './api'
import { parseSet, type SessionDraft, type SessionExerciseDraft } from './schema'

// Plan frente a realizado (spec 006, FR-016, FR-018, FR-019, FR-020). Funciones puras que reproducen en el cliente la
// regla de «modificada» del servidor (`private.compute_session_modified`) para mostrar en qué difiere una sesión.
// La marca «Modificada» la fija siempre el servidor; esto solo explica el porqué.

/** Cantidad de series con algún valor (una serie vacía no cuenta, como en el servidor). */
export const doneSetsCount = (exercise: SessionExerciseDraft): number =>
  exercise.sets.filter((set) => !parseSet(exercise.measurement_type, set).empty).length

export type PlanItemStatus = 'pending' | 'done' | 'substituted' | 'not_done'

export interface PlanItemState {
  item: PlanItem
  status: PlanItemStatus
  /** El ejercicio realizado propio del ítem, si lo hay (con o sin series). */
  own: SessionExerciseDraft | null
  /** Su sustituto, si lo hay. */
  substitute: SessionExerciseDraft | null
}

/**
 * El estado de cada ítem del plan. «Hecho» necesita un ejercicio propio con al menos una serie; «sustituido», un
 * sustituto con series. Lo demás es «sin hacer todavía» mientras la sesión está en curso y «no realizado» al terminar.
 */
export function planStates(
  plan: PlanItem[],
  draft: SessionDraft,
  finished: boolean,
): PlanItemState[] {
  return [...plan]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const own =
        draft.exercises.find((e) => e.plan_item_id === item.id && !e.is_substitute) ?? null
      const substitute =
        draft.exercises.find((e) => e.plan_item_id === item.id && e.is_substitute) ?? null
      let status: PlanItemStatus
      if (own && doneSetsCount(own) > 0) status = 'done'
      else if (substitute && doneSetsCount(substitute) > 0) status = 'substituted'
      else status = finished ? 'not_done' : 'pending'
      return { item, status, own, substitute }
    })
}

export type Difference =
  | { kind: 'not_done'; name: string }
  | { kind: 'substituted'; planned: string; done: string }
  | { kind: 'added'; name: string }
  | { kind: 'sets'; name: string; planned: number; done: number }

/** En qué difiere lo realizado del plan. No cuentan las diferencias de repeticiones, peso, tiempo o distancia. */
export function sessionDifferences(plan: PlanItem[], draft: SessionDraft): Difference[] {
  if (plan.length === 0) return []
  const differences: Difference[] = []
  for (const { item, status, own, substitute } of planStates(plan, draft, true)) {
    if (status === 'not_done') differences.push({ kind: 'not_done', name: item.exercise_name })
    else if (status === 'substituted') {
      differences.push({
        kind: 'substituted',
        planned: item.exercise_name,
        done: substitute!.exercise_name,
      })
    } else if (own && doneSetsCount(own) !== item.sets) {
      differences.push({
        kind: 'sets',
        name: item.exercise_name,
        planned: item.sets,
        done: doneSetsCount(own),
      })
    }
  }
  for (const exercise of draft.exercises) {
    if (exercise.plan_item_id === null && doneSetsCount(exercise) > 0) {
      differences.push({ kind: 'added', name: exercise.exercise_name })
    }
  }
  return differences
}

export const isModified = (plan: PlanItem[], draft: SessionDraft): boolean =>
  sessionDifferences(plan, draft).length > 0
