import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { ErrorState } from '../../../components/ErrorState'
import { Field } from '../../../components/Field'
import { es } from '../../../copy/es'
import { newRequestId } from '../../../lib/ids'
import { saveRemotely, WriteError } from '../../../lib/mutation'
import { NUTRIENTS, parseDecimal } from '../../foods/nutrition'
import { entryErrorMessage } from '../errors'
import { formatDay, mealLabel, type Meal } from '../meals'
import {
  emptyManualForm,
  manualFormSchema,
  type ManualFormInput,
  type ManualPayload,
} from '../schema'
import { confirmEstimate, type EstimatedItem } from './api'
import { itemToForm, totalEnergyText } from './estimate'

const copy = es.meals.ai.review

/** Los cuatro valores que propone la IA; azúcares, saturadas, fibra y sodio quedan para la carga a mano. */
const AI_NUTRIENTS = NUTRIENTS.filter((n) =>
  ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'].includes(n.key),
)

type Row = {
  key: number
  values: ManualFormInput
  errors: Partial<Record<keyof ManualFormInput, string>>
}

interface EstimateReviewProps {
  date: string
  meal: Meal
  initial: EstimatedItem[]
  onBack: () => void
  onAdded: () => void
}

const label = (key: (typeof AI_NUTRIENTS)[number]['key'], unit: string) =>
  `${es.foods.nutrition.labels[key]} (${unit})`

/**
 * Revisión de lo que propuso la IA (spec 009, FR-003 a FR-005): cada ítem se puede corregir o quitar, se pueden
 * agregar otros, y nada se guarda ni suma al día hasta confirmar. Confirmar es idempotente.
 */
export function EstimateReview({ date, meal, initial, onBack, onAdded }: EstimateReviewProps) {
  const queryClient = useQueryClient()
  const nextKey = useRef(initial.length)
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((item, index) => ({ key: index, values: itemToForm(item), errors: {} })),
  )
  // El mismo identificador en cada reintento: un doble toque o un corte de red no duplica los ítems.
  const [requestId] = useState(newRequestId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)

  const update = (key: number, field: keyof ManualFormInput, value: string) =>
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              values: { ...row.values, [field]: value },
              errors: { ...row.errors, [field]: undefined },
            }
          : row,
      ),
    )

  const energyOf = (values: ManualFormInput): number | null => {
    const parsed = parseDecimal(values.energy_kcal)
    return parsed.valid ? parsed.value : null
  }

  async function confirm() {
    if (busy) return
    setError(null)
    const checked = rows.map((row) => ({ row, result: manualFormSchema.safeParse(row.values) }))
    const failed = checked.some((entry) => !entry.result.success)
    if (rows.length === 0 || failed) {
      setRows(
        checked.map(({ row, result }) => {
          const errors: Row['errors'] = {}
          if (!result.success) {
            for (const issue of result.error.issues) {
              const field = issue.path[0] as keyof ManualFormInput | undefined
              if (field && !errors[field]) errors[field] = issue.message
            }
          }
          return { ...row, errors }
        }),
      )
      setInvalid(failed)
      return
    }
    setInvalid(false)
    const items = checked.map(
      ({ result }) => (result as { success: true; data: ManualPayload }).data,
    )
    setBusy(true)
    try {
      await saveRemotely(
        () => confirmEstimate({ log_date: date, meal, items }, requestId),
        entryErrorMessage,
      )
      void queryClient.invalidateQueries({ queryKey: ['meals'] })
      onAdded()
    } catch (e) {
      // Nada se muestra como agregado si no llegó al servidor; la propuesta y lo editado quedan.
      setError(e instanceof WriteError ? e.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const total = totalEnergyText(rows.map((row) => energyOf(row.values)))

  return (
    <section aria-labelledby="revision-titulo" className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="revision-titulo" className="text-lg font-extrabold">
            {copy.title}
          </h2>
          <button type="button" className="btn-secondary" onClick={onBack}>
            {copy.back}
          </button>
        </div>
        <p className="text-muted">
          {es.meals.add.destination(`${formatDay(date)} · ${mealLabel(meal)}`)}
        </p>
        <p className="text-sm text-muted">{copy.note}</p>
      </div>

      {rows.length === 0 ? (
        <p role="status" className="card-inset px-4 py-3">
          {copy.removed}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <li key={row.key}>
            <fieldset className="card flex flex-col gap-4">
              <legend className="px-1 text-base font-bold">{copy.itemTitle(index + 1)}</legend>
              <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-mark px-2.5 py-1 text-sm font-semibold">
                <span aria-hidden="true">≈</span>
                {copy.status}
              </p>
              <Field
                label={es.meals.manual.description}
                autoComplete="off"
                aria-required="true"
                value={row.values.description}
                error={row.errors.description}
                onChange={(event) => update(row.key, 'description', event.target.value)}
              />
              <Field
                label={es.meals.manual.quantityText}
                autoComplete="off"
                value={row.values.quantity_text}
                error={row.errors.quantity_text}
                onChange={(event) => update(row.key, 'quantity_text', event.target.value)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {AI_NUTRIENTS.map((nutrient) => (
                  <Field
                    key={nutrient.key}
                    label={label(nutrient.key, nutrient.unit)}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-required={nutrient.key === 'energy_kcal' ? 'true' : undefined}
                    hint={nutrient.key === 'energy_kcal' ? undefined : es.meals.manual.optional}
                    value={row.values[nutrient.key]}
                    error={row.errors[nutrient.key]}
                    onChange={(event) => update(row.key, nutrient.key, event.target.value)}
                  />
                ))}
              </div>
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                >
                  {copy.remove(row.values.description.trim())}
                </button>
              </div>
            </fieldset>
          </li>
        ))}
      </ul>

      <div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setRows((current) => [
              ...current,
              { key: nextKey.current++, values: emptyManualForm(), errors: {} },
            ])
          }
        >
          {copy.addItem}
        </button>
      </div>

      {rows.length > 0 ? <p className="font-semibold">{copy.total(total)}</p> : null}
      {invalid ? (
        <p role="alert" className="notice-error px-4 py-3">
          {copy.invalidItems}
        </p>
      ) : null}
      {error ? <ErrorState message={error} /> : null}

      <div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? copy.confirming : copy.confirm}
        </button>
      </div>
    </section>
  )
}
