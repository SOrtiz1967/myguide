import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { useAuth } from '../auth/useAuth'
import { formatValue, NUTRIENTS } from '../foods/nutrition'
import { deleteEntry, updateEntry, type MealEntry } from './api'
import { entryQuantityText } from './entryText'
import { manualEntryChanges } from './entryChanges'
import { EntryEditor } from './EntryEditor'
import { formatDay, mealLabel } from './meals'
import { ManualEntryForm } from './ManualEntryForm'
import { SaveAsFoodPanel } from './SaveAsFoodPanel'
import { useEntry } from './useEntry'
import { useToday } from './useToday'
import type { ManualFormInput } from './schema'

const text = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

function manualInitial(entry: MealEntry): ManualFormInput {
  return {
    description: entry.food_name,
    quantity_text: entry.quantity_text ?? '',
    energy_kcal: text(entry.energy_kcal),
    protein_g: text(entry.protein_g),
    carbs_g: text(entry.carbs_g),
    sugars_g: text(entry.sugars_g),
    fat_g: text(entry.fat_g),
    saturated_fat_g: text(entry.saturated_fat_g),
    fiber_g: text(entry.fiber_g),
    sodium_mg: text(entry.sodium_mg),
  }
}

/** Elimina el ítem tras confirmar (FR-022); el diálogo sigue abierto si falla. */
function useDeleteEntry(entry: MealEntry) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => saveRemotely(() => deleteEntry(entry.id)),
    onMutate: () => setError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meals'] })
      void navigate(`/comidas/${entry.log_date}`)
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : es.meals.entry.deleteFailed),
  })
  return {
    open,
    show: () => {
      setError(null)
      setOpen(true)
    },
    hide: () => setOpen(false),
    confirm: () => mutation.mutate(),
    pending: mutation.isPending,
    error,
  }
}

function Values({ entry }: { entry: MealEntry }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="pb-2 text-left text-lg font-semibold">{es.meals.entry.values}</caption>
      <tbody>
        {NUTRIENTS.map((nutrient) => (
          <tr key={nutrient.key} className="border-t border-line">
            <th
              scope="row"
              className={`py-1.5 pr-3 font-normal ${nutrient.indent ? 'pl-5 text-muted' : 'font-medium'}`}
            >
              {es.foods.nutrition.labels[nutrient.key]}
            </th>
            <td
              className={`py-1.5 text-right tabular-nums ${entry[nutrient.key] === null ? 'text-muted' : ''}`}
            >
              {formatValue(entry[nutrient.key], nutrient.unit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Detail({ entry }: { entry: MealEntry }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const today = useToday()
  const queryClient = useQueryClient()
  const remove = useDeleteEntry(entry)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const quantity = entryQuantityText(entry)
  const manual = entry.origin === 'manual' || entry.origin === 'estimated'
  const gone = !manual && entry.food_id === null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={`/comidas/${entry.log_date}`}
          className="inline-flex min-h-11 items-center underline"
        >
          {es.meals.entry.back}
        </Link>
      </div>

      {saved ? <SuccessMessage>{es.meals.entry.saved}</SuccessMessage> : null}

      <header className="flex flex-col gap-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{entry.food_name}</h1>
        {entry.food_brand ? <p className="text-muted">{entry.food_brand}</p> : null}
        <p className="flex flex-wrap items-center gap-x-3 text-muted">
          <span className="rounded-full border border-line px-2 text-sm">
            {es.meals.origin[entry.origin]}
          </span>
          <span>
            {mealLabel(entry.meal)} · {formatDay(entry.log_date)}
          </span>
        </p>
        {quantity ? <p>{quantity}</p> : null}
        {entry.status === 'pending' ? (
          <>
            <p className="font-medium">{es.meals.pending}</p>
            <p className="text-sm text-muted">{es.meals.pendingNote}</p>
          </>
        ) : null}
        {gone ? <p className="text-sm text-muted">{es.meals.day.foodGone}</p> : null}
      </header>

      <Values entry={entry} />

      {manual ? (
        <ManualEntryForm
          key={entry.id}
          userId={userId}
          date={entry.log_date}
          meal={entry.meal}
          draftId={`meal-edit-${entry.id}`}
          initial={manualInitial(entry)}
          title={es.meals.entry.editTitle}
          submitLabel={es.meals.entry.save}
          onSubmit={async (payload) => {
            const changes = manualEntryChanges(entry, payload)
            if (Object.keys(changes).length === 0) return
            await updateEntry(entry.id, changes)
          }}
          onAdded={() => setSaved(true)}
        />
      ) : (
        <EntryEditor
          key={`${entry.quantity}-${entry.portion_count}-${entry.meal}-${entry.log_date}`}
          entry={entry}
          userId={userId}
          today={today}
          onSaved={() => setSaved(true)}
        />
      )}

      {entry.origin === 'manual' ? (
        saving ? (
          <SaveAsFoodPanel
            entry={entry}
            onClose={() => {
              setSaving(false)
              void queryClient.invalidateQueries({ queryKey: ['foods'] })
            }}
          />
        ) : (
          <div>
            <button type="button" className="btn-secondary" onClick={() => setSaving(true)}>
              {es.meals.saveAsFood.action}
            </button>
          </div>
        )
      ) : null}

      <div>
        <button type="button" className="btn-secondary" onClick={remove.show}>
          {es.meals.entry.delete}
        </button>
      </div>

      {remove.open ? (
        <ConfirmDialog
          title={es.meals.entry.deleteTitle}
          description={es.meals.entry.deleteBody}
          confirmLabel={es.meals.entry.confirmDelete}
          cancelLabel={es.meals.entry.cancel}
          onConfirm={remove.confirm}
          onCancel={remove.hide}
          busy={remove.pending}
          error={remove.error}
        />
      ) : null}
    </div>
  )
}

export function EntryDetailPage() {
  const { id = '' } = useParams()
  const { data: entry, isPending, isError, error, refetch } = useEntry(id)

  if (isPending) return <LoadingState label={es.meals.day.loading} />
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState
          message={isNetworkError(error) ? es.meals.day.offlineLoad : es.meals.entry.loadError}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }
  if (!entry) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={es.meals.entry.notFound} />
        <Link to="/comidas" className="inline-flex min-h-11 items-center underline">
          {es.meals.day.goToday}
        </Link>
      </div>
    )
  }
  return <Detail entry={entry} />
}
