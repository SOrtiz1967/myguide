import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { copyFood, deleteFood, type Food } from './api'
import { FoodProvenance } from './FoodProvenance'
import { formatAmount } from './nutrition'
import { NutritionFacts } from './NutritionFacts'
import { useFood } from './useFood'

function Portions({ food }: { food: Food }) {
  return (
    <section aria-labelledby="porciones-titulo">
      <h2 id="porciones-titulo" className="text-lg font-semibold">
        {es.foods.portions.title}
      </h2>
      {food.portions.length === 0 ? (
        <p className="mt-2 text-muted">{es.foods.portions.none}</p>
      ) : (
        <ul className="mt-2">
          {food.portions.map((portion) => (
            <li key={portion.id}>
              {es.foods.portions.amount(
                portion.name,
                formatAmount(portion.quantity, food.reference_basis),
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Crea la copia propia (idempotente: un reintento reutiliza el mismo identificador) y lleva a editarla. */
function useCopyAction(food: Food) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [requestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => saveRemotely(() => copyFood(food.id, requestId)),
    onMutate: () => setError(null),
    onSuccess: (copyId) => {
      void queryClient.invalidateQueries({ queryKey: ['foods'] })
      void navigate(`/alimentos/${copyId}/editar`, { state: { copied: true } })
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : es.errors.generic),
  })
  return { copy: () => mutation.mutate(), pending: mutation.isPending, error }
}

/** Elimina el alimento propio (FR-021) y vuelve a la búsqueda. El diálogo sigue abierto si falla. */
function useDeleteAction(food: Food) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => saveRemotely(() => deleteFood(food.id)),
    onMutate: () => setError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['foods'] })
      void navigate('/alimentos', { state: { deleted: true } })
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : es.foods.form.deleteFailed),
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

function Actions({ food }: { food: Food }) {
  const copy = useCopyAction(food)
  const remove = useDeleteAction(food)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {food.origin === 'imported' ? (
          <button type="button" className="btn-primary" disabled={copy.pending} onClick={copy.copy}>
            {es.foods.actions.createMine}
          </button>
        ) : (
          <>
            <Link to={`/alimentos/${food.id}/editar`} className="btn-primary">
              {es.foods.actions.edit}
            </Link>
            <button
              type="button"
              className="btn-secondary"
              disabled={copy.pending}
              onClick={copy.copy}
            >
              {es.foods.actions.copy}
            </button>
            <button type="button" className="btn-secondary" onClick={remove.show}>
              {es.foods.actions.delete}
            </button>
          </>
        )}
      </div>
      {copy.error ? <ErrorState message={copy.error} /> : null}
      {remove.open ? (
        <ConfirmDialog
          title={es.foods.form.deleteTitle}
          description={es.foods.form.deleteBody}
          confirmLabel={es.foods.actions.confirmDelete}
          cancelLabel={es.foods.actions.cancel}
          onConfirm={remove.confirm}
          onCancel={remove.hide}
          busy={remove.pending}
          error={remove.error}
        />
      ) : null}
    </div>
  )
}

export function FoodDetailPage() {
  const { id = '' } = useParams()
  const state = useLocation().state as { from?: string; saved?: boolean } | null
  const from = state?.from ?? ''
  const { data: food, isPending, isError, refetch } = useFood(id)
  const back = (
    <Link to={`/alimentos${from}`} className="inline-flex min-h-11 items-center underline">
      {es.foods.backToSearch}
    </Link>
  )

  if (isPending) return <LoadingState />
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState message={es.foods.detailError} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!food) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={es.foods.notFound} />
        {back}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>{back}</div>
      {state?.saved ? <SuccessMessage>{es.foods.form.saved}</SuccessMessage> : null}
      <header className="flex flex-col gap-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{food.name}</h1>
        {food.brand ? <p className="text-muted">{food.brand}</p> : null}
        {food.name_status === 'machine_translated' ? (
          <p className="text-sm text-muted">{es.foods.nameStatus.machine_translated}</p>
        ) : null}
      </header>
      <NutritionFacts food={food} />
      <Portions food={food} />
      <FoodProvenance food={food} />
      <Actions food={food} />
    </div>
  )
}
