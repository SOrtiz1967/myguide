import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { energyCoherence, NUTRIENTS, parseDecimal } from './nutrition'
import {
  foodDraftSchema,
  foodFormSchema,
  MAX_PORTIONS,
  type FoodFormInput,
  type FoodPayload,
} from './schema'

interface FoodFormProps {
  /** Dueño del borrador local (la cuenta con sesión). */
  userId: string
  /** Identifica el borrador: `food-new`, `food-edit-<id>`... */
  formId: string
  initialValues: FoodFormInput
  submitLabel: string
  /**
   * Envía el alimento al servidor y devuelve el id confirmado. Debe lanzar `WriteError` si no llegó
   * (FR-031). El `requestId` es estable para este formulario: un reintento no crea un duplicado (FR-023).
   */
  onSubmit: (payload: FoodPayload, requestId: string) => Promise<string>
  /** Se llama solo cuando el servidor confirmó el guardado. */
  onSaved: (id: string) => void
}

const unitOf = (basis: string) => (basis === '100ml' ? 'ml' : 'g')

const nutrientLabel = (key: (typeof NUTRIENTS)[number]['key']) => {
  const nutrient = NUTRIENTS.find((n) => n.key === key)!
  return `${es.foods.nutrition.labels[key]} (${nutrient.unit})`
}

function numberOrNull(text: string | undefined): number | null {
  const parsed = parseDecimal(text ?? '')
  return parsed.valid ? parsed.value : null
}

export function FoodForm({
  userId,
  formId,
  initialValues,
  submitLabel,
  onSubmit,
  onSaved,
}: FoodFormProps) {
  const draft = useDraft({ userId, formId, schema: foodDraftSchema })
  const [requestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FoodFormInput, unknown, FoodPayload>({
    resolver: zodResolver(foodFormSchema),
    defaultValues: draft.initial ?? initialValues,
  })
  const portions = useFieldArray({ control, name: 'portions' })

  // Cada cambio se guarda como borrador local; si vuelve a coincidir con lo inicial, no queda uno obsoleto.
  const values = useWatch({ control })
  const saveDraft = draft.save
  useEffect(() => {
    const current = foodDraftSchema.safeParse(values)
    if (!current.success) return
    if (JSON.stringify(current.data) === JSON.stringify(initialValues)) {
      discardDraft(userId, formId)
    } else {
      saveDraft(current.data)
    }
  }, [values, saveDraft, initialValues, userId, formId])

  const basis = useWatch({ control, name: 'reference_basis' })
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
      const id = await onSubmit(payload, requestId)
      discardDraft(userId, formId)
      onSaved(id)
    } catch (e) {
      // FR-031: nada se muestra como guardado si no llegó al servidor; lo escrito y el borrador quedan.
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {draft.restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{es.foods.form.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                reset(initialValues)
                draft.discard()
              }}
            >
              {es.foods.form.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <Field
        label={es.foods.form.name}
        autoComplete="off"
        aria-required="true"
        error={errors.name?.message}
        {...register('name')}
      />
      <Field
        label={es.foods.form.brand}
        autoComplete="off"
        error={errors.brand?.message}
        {...register('brand')}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium">{es.foods.form.basisLegend}</legend>
        <div className="flex flex-wrap gap-4">
          {(['100g', '100ml'] as const).map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                value={option}
                className="size-5"
                {...register('reference_basis')}
              />
              {es.foods.form.basis[option]}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NUTRIENTS.map((nutrient) => (
            <Field
              key={nutrient.key}
              label={nutrientLabel(nutrient.key)}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-required={nutrient.key === 'energy_kcal' ? 'true' : undefined}
              hint={nutrient.key === 'energy_kcal' ? undefined : es.foods.form.optional}
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
      </fieldset>

      <section className="flex flex-col gap-3" aria-labelledby="form-porciones">
        <h2 id="form-porciones" className="text-lg font-semibold">
          {es.foods.portions.title}
        </h2>
        {errors.portions?.message ? (
          <p className="text-sm text-danger">{errors.portions.message}</p>
        ) : null}
        {portions.fields.map((field, index) => (
          <fieldset
            key={field.id}
            className="flex flex-col gap-3 rounded-md border border-line p-3"
          >
            <legend className="px-1 text-sm text-muted">
              {es.foods.form.portionLegend(index + 1)}
            </legend>
            <Field
              label={es.foods.form.portionName}
              autoComplete="off"
              error={errors.portions?.[index]?.name?.message}
              {...register(`portions.${index}.name` as const)}
            />
            <Field
              label={`${es.foods.form.portionAmount} (${unitOf(basis)})`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              error={errors.portions?.[index]?.quantity?.message}
              {...register(`portions.${index}.quantity` as const)}
            />
            <div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => portions.remove(index)}
              >
                {es.foods.actions.removePortion}
              </button>
            </div>
          </fieldset>
        ))}
        <div>
          <button
            type="button"
            className="btn-secondary"
            disabled={portions.fields.length >= MAX_PORTIONS}
            onClick={() => portions.append({ name: '', quantity: '' })}
          >
            {es.foods.actions.addPortion}
          </button>
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}

      <div>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
