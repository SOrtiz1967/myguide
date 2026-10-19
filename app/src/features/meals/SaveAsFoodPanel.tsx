import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { createFood } from '../foods/api'
import {
  basisLabel,
  formatValue,
  NUTRIENTS,
  parseDecimal,
  type ReferenceBasis,
} from '../foods/nutrition'
import { foodFormSchema } from '../foods/schema'
import { foodValuesFromEntry } from './saveAsFood'
import type { MealEntry } from './api'

type EntryForFood = Pick<
  MealEntry,
  | 'food_name'
  | 'quantity_text'
  | 'energy_kcal'
  | 'protein_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sodium_mg'
>

interface SaveAsFoodPanelProps {
  entry: EntryForFood
  onClose: () => void
  onSaved?: (foodId: string) => void
}

const MAX_AMOUNT = 5000

/** "Energía: Debe estar entre 0 y 900." — el primer problema, con el campo al que se refiere. */
function describeIssue(path: PropertyKey | undefined, message: string): string {
  const nutrient = NUTRIENTS.find((n) => n.key === path)
  return nutrient ? `${es.foods.nutrition.labels[nutrient.key]}: ${message}` : message
}

/**
 * Convierte un ítem manual en un alimento propio (FR-023). Pide cuánto pesa o mide la cantidad que
 * describe el ítem, calcula los valores por 100 y crea el alimento con esa cantidad como porción.
 * El ítem registrado no cambia.
 */
export function SaveAsFoodPanel({ entry, onClose, onSaved }: SaveAsFoodPanelProps) {
  const queryClient = useQueryClient()
  const [basis, setBasis] = useState<ReferenceBasis>('100g')
  const [amountText, setAmountText] = useState('')
  const [requestId] = useState(newRequestId)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const parsed = parseDecimal(amountText)
  const amount = parsed.valid ? parsed.value : null
  const validAmount = amount !== null && amount > 0 && amount <= MAX_AMOUNT
  const preview = validAmount
    ? foodFormSchema.safeParse(foodValuesFromEntry(entry, basis, amount))
    : null

  async function submit() {
    setError(null)
    setFieldError(undefined)
    if (!validAmount) {
      setFieldError(es.meals.saveAsFood.errors.amount)
      return
    }
    const result = foodFormSchema.safeParse(foodValuesFromEntry(entry, basis, amount))
    if (!result.success) {
      const issue = result.error.issues[0]
      setError(describeIssue(issue?.path[0], issue?.message ?? es.errors.generic))
      return
    }
    setSending(true)
    try {
      const id = await saveRemotely(() => createFood(result.data, requestId))
      void queryClient.invalidateQueries({ queryKey: ['foods'] })
      setSavedId(id)
      onSaved?.(id)
    } catch (e) {
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setSending(false)
    }
  }

  if (savedId) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
        <SuccessMessage>{es.meals.saveAsFood.saved}</SuccessMessage>
        <div className="flex flex-wrap gap-3">
          <Link to={`/alimentos/${savedId}`} className="btn-secondary">
            {es.meals.saveAsFood.viewFood}
          </Link>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {es.meals.saveAsFood.cancel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h3 className="text-lg font-semibold">{es.meals.saveAsFood.title}</h3>
      <p className="text-muted">{es.meals.saveAsFood.intro}</p>

      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">{es.meals.saveAsFood.basisLegend}</legend>
        <div className="flex flex-wrap gap-x-4">
          {(['100g', '100ml'] as const).map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="medida-alimento"
                className="size-5"
                checked={basis === option}
                onChange={() => setBasis(option)}
              />
              {option === '100g' ? es.meals.saveAsFood.grams : es.meals.saveAsFood.milliliters}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label={
          basis === '100ml'
            ? es.meals.saveAsFood.amountMilliliters
            : es.meals.saveAsFood.amountGrams
        }
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        error={fieldError}
        onChange={(event) => setAmountText(event.target.value)}
      />

      {preview?.success ? (
        <table className="w-full border-collapse text-left" aria-label={basisLabel(basis)}>
          <caption className="pb-2 text-left font-medium">{basisLabel(basis)}</caption>
          <tbody>
            {NUTRIENTS.map((nutrient) => (
              <tr key={nutrient.key} className="border-t border-line">
                <th
                  scope="row"
                  className={`py-1.5 pr-3 font-normal ${nutrient.indent ? 'pl-5 text-muted' : ''}`}
                >
                  {es.foods.nutrition.labels[nutrient.key]}
                </th>
                <td className="py-1.5 text-right tabular-nums">
                  {formatValue(preview.data[nutrient.key], nutrient.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={sending}>
          {es.meals.saveAsFood.save}
        </button>
        <button type="button" className="btn-secondary" disabled={sending} onClick={onClose}>
          {es.meals.saveAsFood.cancel}
        </button>
      </div>
    </form>
  )
}
