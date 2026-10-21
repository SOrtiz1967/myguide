import type { Dispatch, ReactNode } from 'react'
import { es } from '../../copy/es'
import { measurementLabel } from '../exercises/exerciseLists'
import { EffortSelect } from './EffortSelect'
import { MAX_SETS } from './limits'
import type { SessionExerciseDraft, SessionExerciseErrors } from './schema'
import { SetRow } from './SetRow'
import type { EditorAction } from './sessionEditorState'

const e = es.training.editor

interface SessionExerciseCardProps {
  exercise: SessionExerciseDraft
  /** Posición (empieza en 0) y cantidad de ejercicios de la sesión. */
  index: number
  count: number
  errors?: SessionExerciseErrors
  dispatch: Dispatch<EditorAction>
  /** Información adicional del ejercicio (por ejemplo, su plan o «la última vez»). */
  children?: ReactNode
}

/** Un ejercicio realizado: sus series, su esfuerzo percibido y su nota. */
export function SessionExerciseCard({
  exercise,
  index,
  count,
  errors,
  dispatch,
  children,
}: SessionExerciseCardProps) {
  const { id, exercise_name: name } = exercise
  return (
    <article
      aria-label={name}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold">{name}</h3>
          <p className="text-sm text-muted">{measurementLabel(exercise.measurement_type)}</p>
        </div>
        <span className="flex shrink-0 gap-1">
          <button
            type="button"
            className="btn-secondary"
            aria-label={e.moveExerciseUp(name)}
            disabled={index === 0}
            onClick={() => dispatch({ type: 'moveExercise', id, direction: 'up' })}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            aria-label={e.moveExerciseDown(name)}
            disabled={index === count - 1}
            onClick={() => dispatch({ type: 'moveExercise', id, direction: 'down' })}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            aria-label={e.removeExercise(name)}
            onClick={() => dispatch({ type: 'removeExercise', id })}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </span>
      </header>

      {children}

      <section aria-label={e.setsTitle} className="flex flex-col gap-2">
        {exercise.sets.length === 0 ? (
          <p className="text-muted">{e.noSetsYet}</p>
        ) : (
          <ol className="flex flex-col">
            {exercise.sets.map((input, setIndex) => (
              <SetRow
                key={setIndex}
                exerciseId={id}
                type={exercise.measurement_type}
                index={setIndex}
                count={exercise.sets.length}
                input={input}
                errors={errors?.sets[setIndex]}
                dispatch={dispatch}
              />
            ))}
          </ol>
        )}
        {errors?.setsError ? <p className="text-sm text-danger">{errors.setsError}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={exercise.sets.length >= MAX_SETS}
            onClick={() => dispatch({ type: 'addSet', exerciseId: id })}
          >
            {e.addSet}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={exercise.sets.length >= MAX_SETS}
            onClick={() => dispatch({ type: 'copyPreviousSet', exerciseId: id })}
          >
            {e.copySet}
          </button>
        </div>
      </section>

      <EffortSelect
        exerciseName={name}
        value={exercise.effort}
        error={errors?.effort}
        onChange={(value) => dispatch({ type: 'setEffort', exerciseId: id, value })}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-nota`} className="font-medium">
          {e.exerciseNote}
        </label>
        <textarea
          id={`${id}-nota`}
          rows={2}
          value={exercise.note}
          aria-invalid={errors?.note ? true : undefined}
          onChange={(event) =>
            dispatch({ type: 'setExerciseNote', exerciseId: id, value: event.target.value })
          }
          className="rounded-md border border-line bg-surface px-3 py-2"
        />
        {errors?.note ? <p className="text-sm text-danger">{errors.note}</p> : null}
      </div>
    </article>
  )
}
