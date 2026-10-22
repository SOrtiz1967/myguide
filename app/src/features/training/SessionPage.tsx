import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { useAuth } from '../auth/useAuth'
import { fetchSession, saveWorkout, type PlanItem, type WorkoutSession } from './api'
import { ExercisePickerPanel } from './ExercisePickerPanel'
import { PlanSection, PlanTag } from './PlanVsDone'
import { SessionEditor } from './SessionEditor'
import { draftFromSession } from './sessionEditorState'
import { SessionHeader, SessionSummaryView } from './SessionSummaryView'
import { useSession } from './useSession'
import { useSessionEditor } from './useSessionEditor'

const t = es.training
const e = t.editor

/** El editor de una sesión en curso, con su borrador local y su autoguardado. */
function SessionEditorView({ session }: { session: WorkoutSession }) {
  const { session: auth } = useAuth()
  const queryClient = useQueryClient()
  // Qué se está eligiendo: un ejercicio nuevo o el sustituto de un ítem del plan.
  const [picking, setPicking] = useState<{ item: PlanItem | null } | null>(null)
  const plan = [...session.session_plan_items].sort((a, b) => a.position - b.position)
  const [finished, setFinished] = useState(false)
  const [finishError, setFinishError] = useState(false)

  const save = useCallback(
    (payload: Parameters<typeof saveWorkout>[1], revision: number, finish: boolean) =>
      saveWorkout(session.id, payload, revision, finish),
    [session.id],
  )
  const loadServer = useCallback(async () => {
    const fresh = await fetchSession(session.id)
    if (!fresh) throw new Error('not_found')
    return { revision: fresh.revision, draft: draftFromSession(fresh) }
  }, [session.id])

  const editor = useSessionEditor({
    userId: auth?.user.id ?? '',
    sessionId: session.id,
    initial: { revision: session.revision, draft: draftFromSession(session) },
    save,
    loadServer,
  })

  async function finish() {
    setFinishError(false)
    const outcome = await editor.finish()
    if (outcome.kind === 'ok') {
      setFinished(true)
      await queryClient.invalidateQueries({ queryKey: ['training'] })
    } else if (outcome.kind === 'error') {
      setFinishError(true)
    }
  }

  if (finished) return <LoadingState label={t.session.finishing} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/entrenamiento" className="inline-flex min-h-11 items-center underline">
          {t.session.back}
        </Link>
      </div>
      <SessionHeader session={session} />

      {editor.restored ? (
        <div
          role="note"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{e.restored}</p>
          <div>
            <button type="button" className="btn-secondary" onClick={editor.discardRestored}>
              {e.discardRestored}
            </button>
          </div>
        </div>
      ) : null}

      {editor.conflict ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/10 p-4"
        >
          <p className="font-medium">{e.conflictTitle}</p>
          <p>{e.conflictBody}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void editor.resolveConflict('mine')}
            >
              {e.keepMine}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void editor.resolveConflict('server')}
            >
              {e.useServer}
            </button>
          </div>
        </div>
      ) : null}

      {finishError ? <ErrorState message={e.finishFailed} /> : null}

      <SessionEditor
        draft={editor.draft}
        dispatch={editor.dispatch}
        errors={editor.built.ok ? null : editor.built.errors}
        indicator={editor.indicator}
        onAddExercise={() => setPicking({ item: null })}
        onFinish={() => void finish()}
        onRetry={() => void editor.retry()}
        header={
          <PlanSection
            plan={plan}
            draft={editor.draft}
            dispatch={editor.dispatch}
            onSubstitute={(item) => setPicking({ item })}
          />
        }
        renderExtra={(exerciseId) => (
          <PlanTag plan={plan} draft={editor.draft} exerciseId={exerciseId} />
        )}
      />

      {picking ? (
        <ExercisePickerPanel
          onClose={() => setPicking(null)}
          onPick={(exercise) => {
            editor.dispatch({
              type: 'addExercise',
              exercise: {
                id: newRequestId(),
                exercise_id: exercise.id,
                exercise_name: exercise.name,
                measurement_type: exercise.measurement_type,
                plan_item_id: picking.item?.id ?? null,
                is_substitute: picking.item !== null,
              },
            })
            setPicking(null)
          }}
        />
      ) : null}
    </div>
  )
}

/** Una sesión: en curso se edita; en cualquier otro estado se ve. */
export function SessionPage() {
  const { id = '' } = useParams()
  const { data: session, isPending, isError, refetch } = useSession(id)

  if (isPending) return <LoadingState />
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/entrenamiento" className="inline-flex min-h-11 items-center underline">
          {t.session.back}
        </Link>
        <ErrorState message={t.home.recentError} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={t.errors.notFound} />
        <Link to="/entrenamiento" className="inline-flex min-h-11 items-center underline">
          {t.session.back}
        </Link>
      </div>
    )
  }
  if (session.status === 'in_progress')
    return <SessionEditorView key={session.id} session={session} />
  return <SessionSummaryView session={session} />
}
