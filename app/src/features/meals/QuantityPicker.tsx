import { useId } from 'react'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { formatAmount, formatValue, NUTRIENTS, parseDecimal } from '../foods/nutrition'
import type { PickerFood } from './api'
import { MAX_PORTION_COUNT, MAX_QUANTITY, type QuantityFormInput } from './schema'
import { scaleValue } from './scale'

interface QuantityPickerProps {
  food: PickerFood
  value: QuantityFormInput
  onChange: (value: QuantityFormInput) => void
  error?: string
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Elige la cantidad en gramos o mililitros, o en porciones del alimento, y previsualiza los valores
 * para esa cantidad (FR-002, FR-004). Un valor que falta sigue diciendo "sin dato" (FR-005).
 */
export function QuantityPicker({ food, value, onChange, error }: QuantityPickerProps) {
  const selectId = useId()
  const liquid = food.reference_basis === '100ml'
  const portion = food.portions.find((p) => p.id === value.portion)

  const parsed = parseDecimal(value.amount)
  const amount = parsed.valid ? parsed.value : null
  const max = portion ? MAX_PORTION_COUNT : MAX_QUANTITY
  const valid = amount !== null && amount > 0 && amount <= max
  const quantity = valid ? (portion ? round2(portion.quantity * amount) : amount) : null

  const amountLabel = portion
    ? es.meals.quantity.amountPortions
    : liquid
      ? es.meals.quantity.amountMilliliters
      : es.meals.quantity.amountGrams

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="font-medium">
          {es.meals.quantity.measure}
        </label>
        <select
          id={selectId}
          value={value.portion}
          onChange={(event) =>
            onChange({ portion: event.target.value, amount: event.target.value ? '1' : '100' })
          }
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
        >
          <option value="">
            {liquid ? es.meals.quantity.milliliters : es.meals.quantity.grams}
          </option>
          {food.portions.map((p) => (
            <option key={p.id} value={p.id}>
              {es.meals.quantity.portionOption(
                p.name,
                formatAmount(p.quantity, food.reference_basis),
              )}
            </option>
          ))}
        </select>
      </div>

      <Field
        label={amountLabel}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value.amount}
        error={error}
        onChange={(event) => onChange({ ...value, amount: event.target.value })}
      />

      {portion && quantity !== null ? (
        <p className="text-muted">
          {es.meals.quantity.equivalent(formatAmount(quantity, food.reference_basis))}
        </p>
      ) : null}

      {quantity !== null ? (
        <table className="w-full border-collapse text-left">
          <caption className="pb-2 text-left font-medium">{es.meals.quantity.preview}</caption>
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
                  {formatValue(scaleValue(food[nutrient.key], quantity), nutrient.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
