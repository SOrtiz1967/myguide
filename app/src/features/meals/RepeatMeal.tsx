import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { previewRepeat, repeatMeal } from './api'
import { entryErrorMessage } from './errors'
import {
  addDays,
  formatDay,
  isDateInRange,
  isMeal,
  MEALS,
  mealLabel,
  parseDate,
  type Meal,
} from './meals'
import { useToday } from './useToday'

interface RepeatMealProps {
  date: string
  meal: Meal
}

/**
 * "Repetir en…" (FR-028, FR-029): elige el día y la comida de destino, muestra cuántos ítems se
 * recalculan y cuántos se copian, y repite al confirmar. Un reintento usa la misma solicitud, así que
 * no duplica nada.
 */
export function RepeatMeal({ date, meal }: RepeatMealProps) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <div>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          {es.meals.repeat.action}
        </button>
      </div>
    )
  }
  return <RepeatPanel date={date} meal={meal} onClose={() => setOpen(false)} />
}

function RepeatPanel({ date, meal, onClose }: RepeatMealProps & { onClose: () => void }) {
  const today = useToday()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [toDate, setToDate] = useState(today)
  const [toMeal, setToMeal] = useState<Meal>(meal)
  const [dateError, setDateError] = useState<string | undefined>()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // La misma solicitud en cada reintento de este intento: el servidor no duplica.
  const [requestId] = useState(newRequestId)

  const preview = useQuery({
    queryKey: ['meals', 'repeat-preview', date, meal],
    queryFn: () => previewRepeat(date, meal),
  })

  const repeat = useMutation({
    mutationFn: () =>
      saveRemotely(
        () => repeatMeal({ fromDate: date, fromMeal: meal, toDate, toMeal }, requestId),
        entryErrorMessage,
      ),
    onMutate: () => setError(null),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['meals'] })
      void navigate(`/comidas/${toDate}`, {
        state: { added: es.meals.repeat.done(es.meals.repeat.items(result.created)) },
      })
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : es.meals.repeat.failed),
  })

  function next() {
    const parsed = parseDate(toDate)
    if (!parsed || !isDateInRange(parsed, today)) {
      setDateError(es.meals.errors.invalidDate)
      return
    }
    setDateError(undefined)
    setConfirming(true)
  }

  const destination = `${mealLabel(toMeal)} del ${formatDay(toDate)}`
  const data = preview.data

  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-md border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault()
        next()
      }}
    >
      <h3 className="font-semibold">{es.meals.repeat.title(mealLabel(meal))}</h3>

      <div className="flex flex-col gap-1">
        <label htmlFor={`repetir-dia-${meal}`} className="font-medium">
          {es.meals.repeat.day}
        </label>
        <input
          id={`repetir-dia-${meal}`}
          type="date"
          value={toDate}
          min="2000-01-01"
          max={addDays(today, 7)}
          aria-invalid={dateError ? true : undefined}
          onChange={(event) => setToDate(event.target.value)}
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
        />
        {dateError ? <p className="text-sm text-danger">{dateError}</p> : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`repetir-comida-${meal}`} className="font-medium">
          {es.meals.repeat.meal}
        </label>
        <select
          id={`repetir-comida-${meal}`}
          value={toMeal}
          onChange={(event) => {
            if (isMeal(event.target.value)) setToMeal(event.target.value)
          }}
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
        >
          {MEALS.map((option) => (
            <option key={option} value={option}>
              {mealLabel(option)}
            </option>
          ))}
        </select>
      </div>

      {preview.isPending ? <LoadingState label={es.meals.repeat.loadingPreview} /> : null}
      {preview.isError ? (
        <ErrorState message={es.meals.repeat.previewError} onRetry={() => void preview.refetch()} />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={!data || data.total === 0}>
          {es.meals.repeat.next}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {es.meals.repeat.cancel}
        </button>
      </div>

      {confirming && data ? (
        <ConfirmDialog
          title={es.meals.repeat.confirmTitle(es.meals.repeat.items(data.total))}
          description={es.meals.repeat.confirmBody(
            es.meals.repeat.items(data.total),
            data.recalculated,
            data.copied,
            destination,
          )}
          confirmLabel={es.meals.repeat.confirm}
          cancelLabel={es.meals.repeat.cancel}
          onConfirm={() => repeat.mutate()}
          onCancel={() => {
            setConfirming(false)
            setError(null)
          }}
          busy={repeat.isPending}
          error={error}
        />
      ) : null}
    </form>
  )
}
