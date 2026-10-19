import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { newRequestId } from '../../lib/ids'
import { useDraft } from '../../lib/useDraft'
import { useAuth } from '../auth/useAuth'
import type { FoodSummary } from '../foods/api'
import type { RecentItem } from './api'
import { FoodChooser } from './FoodChooser'
import { formatDay, isMeal, MEALS, mealLabel, parseDate, suggestMeal, type Meal } from './meals'
import { SelectedFoodForm } from './SelectedFoodForm'
import type { QuantityFormInput } from './schema'

/** Forma del borrador: lo elegido y la cantidad, solo texto (puede estar a medio escribir). */
const draftSchema = z.object({ foodId: z.string(), portion: z.string(), amount: z.string() })

interface Selection {
  foodId: string
  value: QuantityFormInput
  /** Identificador del intento: se renueva al elegir otro alimento. */
  requestId: string
}

const toText = (value: number) => String(value).replace('.', ',')

function fromRecent(item: RecentItem): QuantityFormInput {
  if (item.portion_id && item.portion_count !== null) {
    return { portion: item.portion_id, amount: toText(item.portion_count) }
  }
  return { portion: '', amount: item.quantity !== null ? toText(item.quantity) : '100' }
}

export function AddEntryPage() {
  const { fecha = '' } = useParams()
  const date = parseDate(fecha)
  if (!date) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{es.meals.title}</h1>
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
          {es.meals.day.invalidDate}
        </p>
        <Link to="/comidas" className="inline-flex min-h-11 items-center underline">
          {es.meals.day.goToday}
        </Link>
      </div>
    )
  }
  // `key`: al cambiar de día se empieza de cero.
  return <AddEntryForm key={date} date={date} />
}

function AddEntryForm({ date }: { date: string }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const mealParam = params.get('comida')
  const meal: Meal = isMeal(mealParam) ? mealParam : suggestMeal()
  // El borrador se identifica por el día y la comida con que se abrió la pantalla.
  const [draftId] = useState(() => `meal-add-${date}-${meal}`)
  const draft = useDraft({ userId, formId: draftId, schema: draftSchema })

  const [selection, setSelection] = useState<Selection | null>(() =>
    draft.initial
      ? {
          foodId: draft.initial.foodId,
          value: { portion: draft.initial.portion, amount: draft.initial.amount },
          requestId: newRequestId(),
        }
      : null,
  )
  const [restored, setRestored] = useState(draft.restored)

  // Cada cambio se guarda como borrador hasta que el servidor confirma (FR-037).
  const saveDraft = draft.save
  useEffect(() => {
    if (!selection) return
    saveDraft({ foodId: selection.foodId, ...selection.value })
  }, [selection, saveDraft])

  function choose(foodId: string, value: QuantityFormInput) {
    setRestored(false)
    setSelection({ foodId, value, requestId: newRequestId() })
  }

  function chooseOther() {
    discardDraft(userId, draftId)
    setRestored(false)
    setSelection(null)
  }

  function changeMeal(next: Meal) {
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous)
        updated.set('comida', next)
        return updated
      },
      { replace: true },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to={`/comidas/${date}`} className="inline-flex min-h-11 items-center underline">
          {es.meals.add.cancel}
        </Link>
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {es.meals.add.title(mealLabel(meal))}
        </h1>
        <p className="text-muted">{es.meals.add.destination(formatDay(date))}</p>
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{es.meals.add.meal}</legend>
        <div className="flex flex-wrap gap-x-4">
          {MEALS.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="comida"
                value={option}
                className="size-5"
                checked={meal === option}
                onChange={() => changeMeal(option)}
              />
              {mealLabel(option)}
            </label>
          ))}
        </div>
      </fieldset>

      {restored && selection ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{es.meals.add.draftRestored}</p>
          <div>
            <button type="button" className="btn-secondary" onClick={chooseOther}>
              {es.meals.add.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      {selection ? (
        <SelectedFoodForm
          key={selection.requestId}
          foodId={selection.foodId}
          value={selection.value}
          onValueChange={(value) => setSelection({ ...selection, value })}
          requestId={selection.requestId}
          date={date}
          meal={meal}
          userId={userId}
          draftId={draftId}
          onChooseOther={chooseOther}
          onAdded={() =>
            void navigate(`/comidas/${date}`, { state: { added: es.meals.addedTo[meal] } })
          }
        />
      ) : (
        <FoodChooser
          onPickRecent={(item) => {
            if (item.food_id) choose(item.food_id, fromRecent(item))
          }}
          onPickFood={(food: FoodSummary) => choose(food.id, { portion: '', amount: '100' })}
        />
      )}
    </div>
  )
}
