import type { Dispatch, ReactNode } from 'react'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import type { PlanItem } from './api'
import { planStates, sessionDifferences, type PlanItemState, type PlanItemStatus } from './planDiff'
import type { SessionDraft } from './schema'
import type { EditorAction } from './sessionEditorState'
import { formatTargets } from './trainingText'

const p = es.training.plan

function statusText(state: PlanItemState): string {
  const text: Record<PlanItemStatus, string> = {
    pending: p.pending,
    done: p.done,
    substituted: p.substitutedBy(state.substitute?.exercise_name ?? ''),
    not_done: p.notDone,
  }
  return text[state.status]
}

interface PlanListProps {
  plan: PlanItem[]
  draft: SessionDraft
  finished: boolean
  /** Acciones de cada ítem (solo mientras la sesión está en curso). */
  renderActions?: (state: PlanItemState) => ReactNode
}

/**
 * El plan de la sesión: lo que se pensaba hacer, con su objetivo como REFERENCIA y su estado. Nunca mezcla lo
 * planificado con lo realizado (FR-016): el objetivo se rotula como referencia y no se carga en ninguna serie.
 */
export function PlanList({ plan, draft, finished, renderActions }: PlanListProps) {
  return (
    <ul aria-label={p.title} className="flex flex-col gap-3">
      {planStates(plan, draft, finished).map((state) => {
        const { item } = state
        const targets = formatTargets(item.measurement_type, item)
        return (
          <li
            key={item.id}
            aria-label={item.exercise_name}
            className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4"
          >
            <span className="break-words font-semibold">{item.exercise_name}</span>
            <span className="text-sm">{es.training.routines.setsOf(item.sets)}</span>
            <span className="text-sm text-muted">
              {p.reference}: {targets || es.training.noData}
            </span>
            {item.targets_dropped ? <span className="text-sm">{p.droppedTargets}</span> : null}
            {item.exercise_id === null && !finished ? (
              <span className="text-sm">{p.missingExercise}</span>
            ) : null}
            <span className="text-sm font-medium">{statusText(state)}</span>
            {renderActions ? renderActions(state) : null}
          </li>
        )
      })}
    </ul>
  )
}

interface PlanSectionProps {
  plan: PlanItem[]
  draft: SessionDraft
  dispatch: Dispatch<EditorAction>
  /** Pide el ejercicio que sustituirá a un ítem del plan. */
  onSubstitute: (item: PlanItem) => void
  finished?: boolean
}

/** El bloque «Plan» del editor: cada ítem se puede hacer tal cual o sustituir (FR-018). */
export function PlanSection({
  plan,
  draft,
  dispatch,
  onSubstitute,
  finished = false,
}: PlanSectionProps) {
  if (plan.length === 0) return <p className="text-muted">{es.training.noPlan}</p>
  return (
    <section aria-labelledby="plan-titulo-editor" className="flex flex-col gap-3">
      <h2 id="plan-titulo-editor" className="text-xl font-semibold">
        {p.title}
      </h2>
      <PlanList
        plan={plan}
        draft={draft}
        finished={finished}
        renderActions={({ item, own, substitute }) =>
          finished || own || substitute ? null : (
            <span className="mt-1 flex flex-wrap gap-3">
              {item.exercise_id !== null ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    dispatch({
                      type: 'addExercise',
                      exercise: {
                        id: newRequestId(),
                        exercise_id: item.exercise_id,
                        exercise_name: item.exercise_name,
                        measurement_type: item.measurement_type,
                        plan_item_id: item.id,
                      },
                    })
                  }
                >
                  {p.doIt}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => onSubstitute(item)}>
                {p.substitute}
              </button>
            </span>
          )
        }
      />
    </section>
  )
}

/** Dice de dónde viene un ejercicio realizado: del plan, en lugar de otro, o agregado (solo si hay plan). */
export function PlanTag({
  plan,
  draft,
  exerciseId,
}: {
  plan: PlanItem[]
  draft: SessionDraft
  exerciseId: string
}) {
  if (plan.length === 0) return null
  const exercise = draft.exercises.find((e) => e.id === exerciseId)
  if (!exercise) return null
  const planned = plan.find((item) => item.id === exercise.plan_item_id)
  const text = !planned
    ? p.tagAdded
    : exercise.is_substitute
      ? p.tagInstead(planned.exercise_name)
      : p.tagPlan
  return <p className="w-fit rounded-full border border-line px-2 text-sm text-muted">{text}</p>
}

/** En qué difiere lo realizado del plan, con palabras neutrales. No se muestra si no difiere. */
export function Differences({ plan, draft }: { plan: PlanItem[]; draft: SessionDraft }) {
  const differences = sessionDifferences(plan, draft)
  if (differences.length === 0) return null
  return (
    <section aria-labelledby="diferencias-titulo" className="flex flex-col gap-2">
      <h2 id="diferencias-titulo" className="text-xl font-semibold">
        {p.differencesTitle}
      </h2>
      <ul className="ml-5 list-disc">
        {differences.map((difference, index) => (
          <li key={index}>
            {difference.kind === 'not_done'
              ? p.diff.not_done(difference.name)
              : difference.kind === 'substituted'
                ? p.diff.substituted(difference.planned, difference.done)
                : difference.kind === 'added'
                  ? p.diff.added(difference.name)
                  : p.diff.sets(difference.name, difference.planned, difference.done)}
          </li>
        ))}
      </ul>
    </section>
  )
}
