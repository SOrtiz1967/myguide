import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { basisLabel, formatValue } from '../foods/nutrition'
import type { FoodSummary } from '../foods/api'
import { useFoodSearch } from '../foods/useFoodSearch'
import { fetchRecents, type EntryOrigin, type RecentItem } from './api'

interface FoodChooserProps {
  onPickRecent: (item: RecentItem) => void
  onPickFood: (food: FoodSummary) => void
}

const originLabel = (origin: EntryOrigin) => es.meals.origin[origin]

const unitOf = (basis: RecentItem['reference_basis']) => (basis === '100ml' ? 'ml' : 'g')

function recentSummary(item: RecentItem): string {
  const amount =
    item.quantity !== null
      ? `${item.quantity.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unitOf(item.reference_basis)}`
      : item.quantity_text
  const energy = formatValue(item.energy_kcal, 'kcal')
  return [amount, energy].filter(Boolean).join(' · ')
}

/** Recientes (FR-040) y búsqueda de alimentos (la de la spec 002) en la misma pantalla. */
export function FoodChooser({ onPickRecent, onPickFood }: FoodChooserProps) {
  const recents = useQuery({ queryKey: ['meals', 'recents'], queryFn: fetchRecents })
  const search = useFoodSearch()

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="recientes-titulo" className="flex flex-col gap-2">
        <h2 id="recientes-titulo" className="text-lg font-semibold">
          {es.meals.add.recents}
        </h2>
        {recents.isPending ? <LoadingState /> : null}
        {recents.isError ? (
          <ErrorState
            message={isNetworkError(recents.error) ? es.foods.offlineSearch : es.foods.searchError}
            onRetry={() => void recents.refetch()}
          />
        ) : null}
        {recents.data && recents.data.length === 0 ? (
          <p className="text-muted">{es.meals.add.recentsEmpty}</p>
        ) : null}
        {recents.data && recents.data.length > 0 ? (
          <ul className="rounded-lg border border-line bg-surface px-3">
            {recents.data.map((item) => (
              <li
                key={`${item.food_id ?? 'manual'}:${item.food_name}`}
                className="border-b border-line last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => onPickRecent(item)}
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 px-1 py-3 text-left"
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="block min-w-0 truncate font-medium">{item.food_name}</span>
                    <span className="shrink-0 rounded-full border border-line px-2 text-sm text-muted">
                      {originLabel(item.origin)}
                    </span>
                  </span>
                  {item.food_brand ? (
                    <span className="block truncate text-muted">{item.food_brand}</span>
                  ) : null}
                  <span className="text-sm text-muted">{recentSummary(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="buscar-titulo" className="flex flex-col gap-3">
        <h2 id="buscar-titulo" className="text-lg font-semibold">
          {es.meals.add.search}
        </h2>
        <div className="flex flex-col gap-1">
          <input
            type="search"
            aria-label={es.meals.add.search}
            autoComplete="off"
            value={search.text}
            onChange={(event) => search.setText(event.target.value)}
            className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
          />
          <p className="text-sm text-muted">{es.meals.add.searchHint}</p>
        </div>

        {search.isLoading ? <LoadingState label={es.foods.searching} /> : null}
        {search.isError ? (
          <ErrorState
            message={isNetworkError(search.error) ? es.foods.offlineSearch : es.foods.searchError}
            onRetry={search.refetch}
          />
        ) : null}
        {search.isEmpty ? <EmptyState title={es.meals.add.noResults} /> : null}
        {search.isEmpty ? (
          <p>
            <Link
              to={`/alimentos/nuevo?nombre=${encodeURIComponent(search.query)}`}
              className="inline-flex min-h-11 items-center underline"
            >
              {es.meals.add.createFood}
            </Link>
          </p>
        ) : null}

        {search.items.length > 0 ? (
          <ul className="rounded-lg border border-line bg-surface px-3">
            {search.items.map((food) => (
              <li key={food.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onPickFood(food)}
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 px-1 py-3 text-left"
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="block min-w-0 truncate font-medium">{food.name}</span>
                    <span className="shrink-0 rounded-full border border-line px-2 text-sm text-muted">
                      {originLabel(food.origin === 'imported' ? 'catalog' : 'own')}
                    </span>
                  </span>
                  {food.brand ? (
                    <span className="block truncate text-muted">{food.brand}</span>
                  ) : null}
                  <span className="text-sm text-muted">
                    {formatValue(food.energy_kcal, 'kcal')} · {basisLabel(food.reference_basis)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {search.hasNextPage ? (
          <div>
            <button
              type="button"
              className="btn-secondary"
              disabled={search.isFetchingNextPage}
              onClick={search.fetchNextPage}
            >
              {search.isFetchingNextPage ? es.foods.loadingMore : es.foods.loadMore}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
