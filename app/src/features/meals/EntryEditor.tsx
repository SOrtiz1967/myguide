import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { fetchFood } from '../foods/api'
import { foodQueryKey } from '../foods/useFood'
import { updateEntry, type MealEntry, type PickerFood } from './api'
import { foodEntryChanges } from './entryChanges'
import { entryErrorMessage } from './errors'
import { addDays, isDateInRange, isMeal, MEALS, mealLabel, parseDate, type Meal } from './meals'
import { QuantityPicker } from './QuantityPicker'
import { quantityFormSchema, type QuantityFormInput } from './schema'

const draftSchema = z.object({
  portion: z.string(),
  amount: z.string(),
  meal: z.string(),
  log_date: z.string(),
})

const toText = (value: number) => String(value).replace('.', ',')

interface EntryEditorProps {
  entry: MealEntry
  userId: string
  today: string
  /** Se llama solo cuando el servidor confirmó el cambio. */
  onSaved: () => void
}

/** Corrige un ítem que viene de un alimento: cantidad o porciones, comida y día (FR-019, FR-020). */
export function EntryEditor({ entry, userId, today, onSaved }: EntryEditorProps) {
  const queryClient = useQueryClient()
  // Las porciones disponibles salen del alimento, mientras exista; si no, queda la que ya tiene el ítem.
  const foodQuery = useQuery({
    queryKey: foodQueryKey(entry.food_id ?? ''),
    queryFn: () => fetchFood(entry.food_id ?? ''),
    enabled: entry.food_id !== null,
  })
  const waiting = entry.food_id !== null && foodQuery.isPending

  if (waiting) return <LoadingState />
  const portions = (foodQuery.data?.portions ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
  }))
  let originalPortionId = ''
  if (entry.portion_name !== null) {
    const match = portions.find((p) => p.name === entry.portion_name)
    if (match) originalPortionId = match.id
    else {
      originalPortionId = 'current'
      portions.push({
        id: 'current',
        name: entry.portion_name,
        quantity: entry.portion_quantity ?? 0,
      })
    }
  }

  return (
    <EditorForm
      entry={entry}
      userId={userId}
      today={today}
      portions={portions}
      originalPortionId={originalPortionId}
      invalidate={() => queryClient.invalidateQueries({ queryKey: ['meals'] })}
      onSaved={onSaved}
    />
  )
}

interface EditorFormProps extends EntryEditorProps {
  portions: PickerFood['portions']
  originalPortionId: string
  invalidate: () => Promise<unknown>
}

function EditorForm({
  entry,
  userId,
  today,
  portions,
  originalPortionId,
  invalidate,
  onSaved,
}: EditorFormProps) {
  const draftId = `meal-edit-${entry.id}`
  const draft = useDraft({ userId, formId: draftId, schema: draftSchema })
  const start = {
    portion: originalPortionId,
    amount:
      entry.portion_count !== null
        ? toText(entry.portion_count)
        : entry.quantity !== null
          ? toText(entry.quantity)
          : '',
    meal: entry.meal as string,
    log_date: entry.log_date,
  }
  const [form, setForm] = useState(draft.initial ?? start)
  const [restored, setRestored] = useState(draft.restored)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [dateError, setDateError] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // Cada cambio se guarda como borrador hasta que el servidor confirma (FR-037).
  const saveDraft = draft.save
  useEffect(() => {
    if (JSON.stringify(form) === JSON.stringify(start)) discardDraft(userId, draftId)
    else saveDraft(form)
    // `start` se recalcula en cada render; solo importa lo que escribe la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, saveDraft, userId, draftId])

  const food: PickerFood = {
    reference_basis: entry.reference_basis ?? '100g',
    energy_kcal: entry.per100_energy_kcal,
    protein_g: entry.per100_protein_g,
    carbs_g: entry.per100_carbs_g,
    sugars_g: entry.per100_sugars_g,
    fat_g: entry.per100_fat_g,
    saturated_fat_g: entry.per100_saturated_fat_g,
    fiber_g: entry.per100_fiber_g,
    sodium_mg: entry.per100_sodium_mg,
    portions,
  }

  async function submit() {
    setError(null)
    setMessage(null)
    setFieldError(undefined)
    setDateError(undefined)

    const parsed = quantityFormSchema.safeParse({ portion: form.portion, amount: form.amount })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)
      return
    }
    const date = parseDate(form.log_date)
    if (!date || !isDateInRange(date, today)) {
      setDateError(es.meals.errors.invalidDate)
      return
    }
    const meal = isMeal(form.meal) ? form.meal : entry.meal
    const changes = foodEntryChanges(entry, {
      meal,
      log_date: date,
      originalPortionId,
      quantity: parsed.data,
    })
    if (Object.keys(changes).length === 0) {
      setMessage(es.meals.entry.noChanges)
      return
    }

    setSending(true)
    try {
      await saveRemotely(() => updateEntry(entry.id, changes), entryErrorMessage)
      discardDraft(userId, draftId)
      await invalidate()
      onSaved()
    } catch (e) {
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h2 className="text-lg font-semibold">{es.meals.entry.editTitle}</h2>

      {restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{es.meals.entry.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setForm(start)
                draft.discard()
                setRestored(false)
              }}
            >
              {es.meals.entry.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <QuantityPicker
        food={food}
        value={{ portion: form.portion, amount: form.amount } satisfies QuantityFormInput}
        onChange={(value) => setForm({ ...form, ...value })}
        error={fieldError}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="editar-comida" className="font-medium">
          {es.meals.entry.meal}
        </label>
        <select
          id="editar-comida"
          value={form.meal}
          onChange={(event) => setForm({ ...form, meal: event.target.value })}
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
        >
          {MEALS.map((option: Meal) => (
            <option key={option} value={option}>
              {mealLabel(option)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="editar-dia" className="font-medium">
          {es.meals.entry.day}
        </label>
        <input
          id="editar-dia"
          type="date"
          value={form.log_date}
          min="2000-01-01"
          max={addDays(today, 7)}
          aria-invalid={dateError ? true : undefined}
          onChange={(event) => setForm({ ...form, log_date: event.target.value })}
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
        />
        {dateError ? <p className="text-sm text-danger">{dateError}</p> : null}
      </div>

      {message ? (
        <p role="status" className="text-muted">
          {message}
        </p>
      ) : null}
      {error ? <ErrorState message={error} /> : null}

      <div>
        <button type="submit" className="btn-primary" disabled={sending}>
          {es.meals.entry.save}
        </button>
      </div>
    </form>
  )
}
