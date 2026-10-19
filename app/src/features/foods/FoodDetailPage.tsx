import { Link, useLocation, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import type { Food } from './api'
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

function Actions({ food }: { food: Food }) {
  return (
    <div className="flex flex-wrap gap-3">
      {food.origin === 'imported' ? (
        <button type="button" className="btn-primary">
          {es.foods.actions.createMine}
        </button>
      ) : (
        <>
          <Link to={`/alimentos/${food.id}/editar`} className="btn-primary">
            {es.foods.actions.edit}
          </Link>
          <button type="button" className="btn-secondary">
            {es.foods.actions.copy}
          </button>
          <button type="button" className="btn-secondary">
            {es.foods.actions.delete}
          </button>
        </>
      )}
    </div>
  )
}

export function FoodDetailPage() {
  const { id = '' } = useParams()
  const from = (useLocation().state as { from?: string } | null)?.from ?? ''
  const { data: food, isPending, isError, refetch } = useFood(id)
  const back = (
    <Link to={`/alimentos${from}`} className="underline">
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
