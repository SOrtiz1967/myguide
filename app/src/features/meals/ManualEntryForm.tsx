import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
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
import { confirmEstimate, estimateMeal, type EstimatedItem } from './ai/api'
import { estimateErrorMessage, itemToForm, mergeItems } from './ai/estimate'
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
  /** Si falta, no hay botón para volver (la pantalla de edición no lo necesita). */
  onCancel?: () => void
  /** Se llama solo cuando el servidor confirmó el guardado. */
  onAdded: () => void
  /**
   * Cómo se guarda. Por omisión agrega un ítem nuevo; la pantalla de edición pasa su propia función.
   * Debe lanzar si el servidor no confirmó.
   */
  onSubmit?: (payload: ManualPayload, requestId: string) => Promise<unknown>
  submitLabel?: string
  /** Título de la sección; `null` lo oculta. */
  title?: string | null
  /** Ofrece «Calcular con IA» (spec 009): solo al agregar, no al corregir un ítem guardado. */
  allowAi?: boolean
}

/** Los cuatro valores que completa la IA. */
const AI_FIELDS = ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'] as const

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
  onSubmit,
  submitLabel = es.meals.manual.save,
  title = es.meals.manual.title,
  allowAi = false,
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
    getValues,
    setValue,
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

  // «Calcular con IA»: completa energía y macros como estimación editable, sin pisar en silencio lo escrito.
  const [estimated, setEstimated] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<EstimatedItem | null>(null)
  const aiRequest = useRef({ text: '', id: newRequestId() })

  function applyProposal(item: EstimatedItem) {
    const form = itemToForm(item)
    for (const key of AI_FIELDS) setValue(key, form[key], { shouldDirty: true })
    setEstimated(true)
    setProposal(null)
  }

  async function calculate() {
    if (aiBusy) return
    setAiError(null)
    const description = getValues('description').trim()
    if (description === '') {
      setAiError(es.meals.ai.manual.needName)
      return
    }
    const quantity = getValues('quantity_text').trim()
    const text = quantity === '' ? description : `${description}, ${quantity}`
    // El mismo texto reutiliza el identificador: reintentar no gasta otra consulta.
    if (aiRequest.current.text !== text) aiRequest.current = { text, id: newRequestId() }
    setAiBusy(true)
    try {
      const merged = mergeItems(await estimateMeal(text, aiRequest.current.id))
      if (!merged) {
        setAiError(es.meals.ai.errors.no_items)
        return
      }
      const hasValues = AI_FIELDS.some((key) => getValues(key).trim() !== '')
      if (hasValues) setProposal(merged)
      else applyProposal(merged)
    } catch (e) {
      setAiError(estimateErrorMessage(e))
    } finally {
      setAiBusy(false)
    }
  }

  const submit = handleSubmit(async (payload) => {
    setError(null)
    try {
      await saveRemotely(
        () =>
          onSubmit
            ? onSubmit(payload, requestId)
            : estimated
              ? confirmEstimate({ log_date: date, meal, items: [payload] }, requestId)
              : addEntry({ log_date: date, meal, origin: 'manual', ...payload }, requestId),
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
    <form onSubmit={submit} noValidate className="card flex flex-col gap-5">
      {title || onCancel ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-extrabold">{title}</h2> : <span />}
          {onCancel ? (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {es.meals.manual.back}
            </button>
          ) : null}
        </div>
      ) : null}

      {draft.restored ? (
        <div role="status" className="flex flex-col gap-2 card-inset p-3">
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

      {onSubmit ? null : <p className="text-muted">{es.meals.add.title(mealLabel(meal))}</p>}

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

      {allowAi ? (
        <div className="flex flex-col gap-3">
          <div>
            <button
              type="button"
              className="btn-secondary"
              disabled={aiBusy}
              onClick={() => void calculate()}
            >
              {aiBusy ? es.meals.ai.manual.calculating : es.meals.ai.manual.calculate}
            </button>
          </div>
          {aiBusy ? (
            <p role="status" className="text-muted">
              {es.meals.ai.estimating}
            </p>
          ) : null}
          {aiError ? <ErrorState message={aiError} /> : null}
          {proposal ? (
            <div
              role="group"
              aria-label={es.meals.ai.manual.replaceTitle}
              className="card-inset p-4"
            >
              <p className="font-semibold">{es.meals.ai.manual.replaceTitle}</p>
              <p className="text-sm text-muted">{es.meals.ai.manual.replaceText}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => applyProposal(proposal)}
                >
                  {es.meals.ai.manual.replace}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setProposal(null)}>
                  {es.meals.ai.manual.keep}
                </button>
              </div>
            </div>
          ) : null}
          {estimated ? (
            <div role="status" className="card-inset px-4 py-3">
              <p className="font-semibold">
                <span aria-hidden="true">≈ </span>
                {es.meals.ai.manual.status}
              </p>
              <p className="text-sm text-muted">{es.meals.ai.manual.note}</p>
            </div>
          ) : null}
        </div>
      ) : null}

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
        <p role="status" className="card-inset px-4 py-3">
          {es.foods.form.coherenceNotice(Math.round(coherence.expected))}
        </p>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <div>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
