import type { Dispatch } from 'react'
import { es } from '../../copy/es'
import type { MeasurementType } from '../exercises/exerciseLists'
import type { EditorAction } from './sessionEditorState'
import type { SetInput } from './schema'
import { setFields, type SetField } from './trainingText'

const t = es.training
const e = t.editor

/** El campo del formulario que corresponde a cada valor de una serie. */
const INPUT_KEY: Record<SetField, keyof SetInput> = {
  reps: 'reps',
  weight_kg: 'weight_kg',
  duration_s: 'duration',
  distance_km: 'distance_km',
}

interface SetRowProps {
  exerciseId: string
  type: MeasurementType
  /** Posición (empieza en 0) y cantidad de series del ejercicio. */
  index: number
  count: number
  input: SetInput
  errors?: Partial<Record<SetField, string>>
  dispatch: Dispatch<EditorAction>
}

/** Una serie: solo los campos que admite el tipo de medición, con su unidad visible. */
export function SetRow({
  exerciseId,
  type,
  index,
  count,
  input,
  errors = {},
  dispatch,
}: SetRowProps) {
  const number = index + 1
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{e.setLabel(number)}</span>
        <span className="flex gap-1">
          <button
            type="button"
            className="btn-secondary"
            aria-label={e.moveSetUp(number)}
            disabled={index === 0}
            onClick={() => dispatch({ type: 'moveSet', exerciseId, index, direction: 'up' })}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            aria-label={e.moveSetDown(number)}
            disabled={index === count - 1}
            onClick={() => dispatch({ type: 'moveSet', exerciseId, index, direction: 'down' })}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            aria-label={e.removeSet(number)}
            onClick={() => dispatch({ type: 'removeSet', exerciseId, index })}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {setFields(type).map((field) => {
          const key = INPUT_KEY[field]
          const error = errors[field]
          const errorId = `${exerciseId}-${number}-${field}-error`
          return (
            <div key={field} className="flex min-w-0 flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {t.fields[field]}
                  <span className="sr-only"> de la serie {number}</span>
                </span>
                <input
                  type="text"
                  inputMode={field === 'reps' ? 'numeric' : 'decimal'}
                  autoComplete="off"
                  value={input[key]}
                  placeholder={t.noData}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) =>
                    dispatch({
                      type: 'editSet',
                      exerciseId,
                      index,
                      field: key,
                      value: event.target.value,
                    })
                  }
                  className="min-h-11 min-w-0 rounded-md border border-line bg-surface px-3 py-2"
                />
              </label>
              {error ? (
                <p id={errorId} className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </li>
  )
}
