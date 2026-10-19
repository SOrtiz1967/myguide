import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { addEntry } from './api'
import { entryErrorMessage } from './errors'
import type { Meal } from './meals'
import { QuantityPicker } from './QuantityPicker'
import { quantityFormSchema, type QuantityFormInput } from './schema'
import { useFood } from '../foods/useFood'

interface SelectedFoodFormProps {
  foodId: string
  value: QuantityFormInput
  onValueChange: (value: QuantityFormInput) => void
  /** Identificador estable de este intento: un reintento no crea un ítem duplicado (FR-009). */
  requestId: string
  date: string
  meal: Meal
  userId: string
  draftId: string
  onChooseOther: () => void
  /** Se llama solo cuando el servidor confirmó el alta. */
  onAdded: () => void
}

export function SelectedFoodForm({
  foodId,
  value,
  onValueChange,
  requestId,
  date,
  meal,
  userId,
  draftId,
  onChooseOther,
  onAdded,
}: SelectedFoodFormProps) {
  const { data: food, isPending, isError, refetch } = useFood(foodId)
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [sending, setSending] = useState(false)

  if (isPending) return <LoadingState label={es.meals.add.loadingFood} />
  if (isError) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorState message={es.meals.add.foodLoadError} onRetry={() => void refetch()} />
        <div>
          <button type="button" className="btn-secondary" onClick={onChooseOther}>
            {es.meals.add.chooseOther}
          </button>
        </div>
      </div>
    )
  }
  if (!food) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorState message={es.meals.errors.foodGone} />
        <div>
          <button type="button" className="btn-secondary" onClick={onChooseOther}>
            {es.meals.add.chooseOther}
          </button>
        </div>
      </div>
    )
  }

  async function submit() {
    setError(null)
    setFieldError(undefined)
    const parsed = quantityFormSchema.safeParse(value)
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)
      return
    }
    setSending(true)
    try {
      await saveRemotely(
        () => addEntry({ log_date: date, meal, food_id: foodId, ...parsed.data }, requestId),
        entryErrorMessage,
      )
      discardDraft(userId, draftId)
      void queryClient.invalidateQueries({ queryKey: ['meals'] })
      onAdded()
    } catch (e) {
      // El borrador y lo elegido quedan: nada se muestra como agregado si no llegó al servidor.
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div>
        <h2 className="break-words text-xl font-semibold">{food.name}</h2>
        {food.brand ? <p className="text-muted">{food.brand}</p> : null}
      </div>

      <QuantityPicker food={food} value={value} onChange={onValueChange} error={fieldError} />

      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={sending}>
          {es.meals.add.confirm}
        </button>
        <button type="button" className="btn-secondary" disabled={sending} onClick={onChooseOther}>
          {es.meals.add.chooseOther}
        </button>
      </div>
    </form>
  )
}
