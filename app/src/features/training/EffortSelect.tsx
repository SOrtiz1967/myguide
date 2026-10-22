import { useId } from 'react'
import { es } from '../../copy/es'
import { MAX_EFFORT, MIN_EFFORT } from './limits'

const t = es.training

interface EffortSelectProps {
  exerciseName: string
  value: string
  onChange: (value: string) => void
  error?: string
}

const levels = Array.from({ length: MAX_EFFORT - MIN_EFFORT + 1 }, (_, i) => MIN_EFFORT + i)

function optionLabel(level: number): string {
  if (level === MIN_EFFORT) return `${level} (${t.editor.effortLowest})`
  if (level === MAX_EFFORT) return `${level} (${t.editor.effortHighest})`
  return String(level)
}

/** Esfuerzo percibido de 1 a 10, uno por ejercicio y para todas sus series en conjunto (FR-014). */
export function EffortSelect({ exerciseName, value, onChange, error }: EffortSelectProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="break-words font-medium">
        {t.editor.effortOfExercise(exerciseName)}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
        className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
      >
        <option value="">{t.effort.none}</option>
        {levels.map((level) => (
          <option key={level} value={level}>
            {optionLabel(level)}
          </option>
        ))}
      </select>
      <p id={hintId} className="text-sm text-muted">
        {t.effort.hint}
      </p>
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
