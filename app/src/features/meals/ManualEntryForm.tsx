import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { newRequestId } from '../../lib/ids'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { energyCoherence, NUTRIENTS, parseDecimal } from '../foods/nutrition'
import { addEntry } from './api'
import { entryErrorMessage } from './errors'
import { mealLabel, type Meal } from './meals'
import {
  manualDraftSchema,
  manualFormSchema,
  emptyManualForm,
  type ManualFormInput,
  type ManualPayload,
} from './schema'

interface ManualEntryFormProps {
  userId: string
  date: string
  meal: Meal
  draftId: string
  /** Valores iniciales (por ejemplo, al repetir un reciente manual). */
  initial?: ManualFormInput
  onCancel: () => void
  /** Se llama solo cuando el servidor confirmó el alta. */
  onAdded: () => void
}

const numberOrNull = (text: string | undefined): number | null => {
  const parsed = parseDecimal(text ?? '')
  return parsed.valid ? parsed.value : null
}

const nutrientLabel = (key: (typeof NUTRIENTS)[number]['key']) => {
  const nutrient = NUTRIENTS.find((n) => n.key === key)!
  return `${es.foods.nutrition.labels[key]} (${nutrient.unit})`
}

/** Lo que se comió, escrito a mano: la energía es obligatoria y el resto, opcional (FR-006). */
export function ManualEntryForm({
  userId,
  date,
  meal,
  draftId,
  initial,
  onCancel,
  onAdded,
}: ManualEntryFormProps) {
  const queryClient = useQueryClient()
  const draft = useDraft({ userId, formId: draftId, schema: manualDraftSchema })
  const [requestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const start = initial ?? emptyManualForm()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ManualFormInput, unknown, ManualPayload>({
    resolver: zodResolver(manualFormSchema),
    defaultValues: draft.initial ?? start,
  })

  // Cada cambio se guarda como borrador hasta que el servidor confirma (FR-037).
  const values = useWatch({ control })
  const saveDraft = draft.save
  useEffect(() => {
    const current = manualDraftSchema.safeParse(values)
    if (!current.success) return
    if (JSON.stringify(current.data) === JSON.stringify(start)) discardDraft(userId, draftId)
    else saveDraft(current.data)
  }, [values, saveDraft, start, userId, draftId])

  const [energy, protein, carbs, fat] = useWatch({
    control,
    name: ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'],
  })
  const coherence = energyCoherence({
    energy: numberOrNull(energy),
    protein: numberOrNull(protein),
    carbs: numberOrNull(carbs),
    fat: numberOrNull(fat),
  })

  const submit = handleSubmit(async (payload) => {
    setError(null)
    try {
      await saveRemotely(
        () => addEntry({ log_date: date, meal, origin: 'manual', ...payload }, requestId),
        entryErrorMessage,
      )
      discardDraft(userId, draftId)
      void queryClient.invalidateQueries({ queryKey: ['meals'] })
      onAdded()
    } catch (e) {
      // Nada se muestra como agregado si no llegó al servidor; lo escrito y el borrador quedan.
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{es.meals.manual.title}</h2>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {es.meals.manual.back}
        </button>
      </div>

      {draft.restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{es.meals.manual.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                reset(start)
                draft.discard()
              }}
            >
              {es.meals.manual.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-muted">{es.meals.add.title(mealLabel(meal))}</p>

      <Field
        label={es.meals.manual.description}
        autoComplete="off"
        aria-required="true"
        error={errors.description?.message}
        {...register('description')}
      />
      <Field
        label={es.meals.manual.quantityText}
        hint={es.meals.manual.quantityTextHint}
        autoComplete="off"
        error={errors.quantity_text?.message}
        {...register('quantity_text')}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {NUTRIENTS.map((nutrient) => (
          <Field
            key={nutrient.key}
            label={nutrientLabel(nutrient.key)}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-required={nutrient.key === 'energy_kcal' ? 'true' : undefined}
            hint={nutrient.key === 'energy_kcal' ? undefined : es.meals.manual.optional}
            error={errors[nutrient.key]?.message}
            {...register(nutrient.key)}
          />
        ))}
      </div>

      {!coherence.coherent && coherence.expected !== null ? (
        <p role="status" className="rounded-md border border-line bg-surface px-4 py-3">
          {es.foods.form.coherenceNotice(Math.round(coherence.expected))}
        </p>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <div>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {es.meals.manual.save}
        </button>
      </div>
    </form>
  )
}
