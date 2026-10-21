import type { Dispatch, ReactNode } from 'react'
import { es } from '../../copy/es'
import { SaveIndicator } from './SaveIndicator'
import type { SessionDraft, SessionErrors } from './schema'
import { SessionExerciseCard } from './SessionExerciseCard'
import type { EditorAction } from './sessionEditorState'
import type { EditorIndicator } from './useSessionEditor'

const e = es.training.editor

interface SessionEditorProps {
  draft: SessionDraft
  dispatch: Dispatch<EditorAction>
  /** Los errores de validación del borrador (nulo si todo es válido). */
  errors: SessionErrors | null
  indicator: EditorIndicator
  onAddExercise: () => void
  onFinish: () => void
  onRetry?: () => void
  finishing?: boolean
  finishLabel?: string
  /** Información que se muestra arriba de un ejercicio (por ejemplo, su plan), por id de ejercicio. */
  renderExtra?: (exerciseId: string) => ReactNode
  /** Bloques de arriba del editor (por ejemplo, el plan de la sesión). */
  header?: ReactNode
}

/** El editor de una sesión: ejercicios, series, esfuerzo, notas, estado de guardado y «Terminar». */
export function SessionEditor({
  draft,
  dispatch,
  errors,
  indicator,
  onAddExercise,
  onFinish,
  onRetry,
  finishing = false,
  finishLabel = e.finish,
  renderExtra,
  header,
}: SessionEditorProps) {
  const hasUnsaved = indicator === 'offline' || indicator === 'failed'
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator indicator={indicator} />
          {hasUnsaved && onRetry ? (
            <button type="button" className="btn-secondary" onClick={onRetry}>
              {e.retry}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={errors !== null || finishing}
          onClick={onFinish}
        >
          {finishing ? e.finishing : finishLabel}
        </button>
      </div>
      {errors ? <p className="text-danger">{e.fixErrors}</p> : null}

      {header}

      <section aria-labelledby="ejercicios-titulo" className="flex flex-col gap-4">
        <h2 id="ejercicios-titulo" className="text-xl font-semibold">
          {e.exercisesTitle}
        </h2>
        {draft.exercises.length === 0 ? <p className="text-muted">{e.noExercises}</p> : null}
        {draft.exercises.map((exercise, index) => (
          <SessionExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            count={draft.exercises.length}
            errors={errors?.exercises[index]}
            dispatch={dispatch}
          >
            {renderExtra?.(exercise.id)}
          </SessionExerciseCard>
        ))}
        {errors?.exercisesError ? (
          <p className="text-sm text-danger">{errors.exercisesError}</p>
        ) : null}
        <div>
          <button type="button" className="btn-secondary" onClick={onAddExercise}>
            {e.addExercise}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-1">
        <label htmlFor="nota-sesion" className="font-medium">
          {e.sessionNote}
        </label>
        <textarea
          id="nota-sesion"
          rows={3}
          value={draft.note}
          aria-invalid={errors?.note ? true : undefined}
          onChange={(event) => dispatch({ type: 'setNote', value: event.target.value })}
          className="rounded-md border border-line bg-surface px-3 py-2"
        />
        {errors?.note ? <p className="text-sm text-danger">{errors.note}</p> : null}
      </div>
    </div>
  )
}
