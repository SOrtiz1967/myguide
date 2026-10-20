import { Link, useLocation, useNavigate } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { OriginTabs } from '../../components/OriginTabs'
import { RESULTS_PANEL_ID, tabId } from '../../components/tabIds'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import type { FoodSummary } from './api'
import { basisLabel, formatValue } from './nutrition'
import { useFoodSearch } from './useFoodSearch'

function originBadge(food: FoodSummary): string {
  if (food.origin === 'imported') return es.foods.originBadge.catalog
  return food.based_on_food_id ? es.foods.originBadge.copy : es.foods.originBadge.own
}

function ResultItem({ food, from }: { food: FoodSummary; from: string }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={`/alimentos/${food.id}`}
        state={{ from }}
        className="flex min-h-11 flex-col gap-0.5 px-1 py-3"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0 truncate font-medium">{food.name}</span>
          <span className="shrink-0 rounded-full border border-line px-2 text-sm text-muted">
            {originBadge(food)}
          </span>
        </span>
        {food.brand ? <span className="block truncate text-muted">{food.brand}</span> : null}
        <span className="text-sm text-muted">
          {formatValue(food.energy_kcal, 'kcal')} · {basisLabel(food.reference_basis)}
        </span>
      </Link>
    </li>
  )
}

export function FoodSearchPage() {
  const search = useFoodSearch()
  const navigate = useNavigate()
  const location = useLocation()
  const deleted = (location.state as { deleted?: boolean } | null)?.deleted === true

  const createNamed = () =>
    void navigate(`/alimentos/nuevo?nombre=${encodeURIComponent(search.query)}`)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{es.foods.title}</h1>
        <Link to="/alimentos/nuevo" className="btn-secondary">
          {es.foods.newFood}
        </Link>
      </div>

      {deleted ? <SuccessMessage>{es.foods.form.deleted}</SuccessMessage> : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="busqueda" className="font-medium">
          {es.foods.searchLabel}
        </label>
        <input
          id="busqueda"
          type="search"
          autoComplete="off"
          value={search.text}
          onChange={(event) => search.setText(event.target.value)}
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
        />
      </div>

      <OriginTabs
        value={search.scope}
        onChange={search.setScope}
        labels={es.foods.tabs}
        ariaLabel={es.foods.tabsLabel}
      />

      <div
        id={RESULTS_PANEL_ID}
        role="tabpanel"
        aria-labelledby={tabId(search.scope)}
        className="flex flex-col gap-3"
      >
        <div aria-live="polite">
          {search.items.length > 0 ? (
            <p className="text-sm text-muted">{es.foods.resultsCount(search.total)}</p>
          ) : null}
        </div>

        {search.tooShort ? <p className="text-muted">{es.foods.searchTooShort}</p> : null}

        {search.isLoading ? <LoadingState label={es.foods.searching} /> : null}

        {search.isError ? (
          <ErrorState
            message={isNetworkError(search.error) ? es.foods.offlineSearch : es.foods.searchError}
            onRetry={search.refetch}
          />
        ) : null}

        {search.isEmpty ? (
          <EmptyState
            title={
              search.catalogEmpty && search.scope === 'catalog'
                ? es.foods.catalogEmpty
                : es.foods.emptyTitle
            }
            description={es.foods.emptyBody}
            actionLabel={es.foods.createNamed(search.query)}
            onAction={createNamed}
          />
        ) : null}

        {search.items.length > 0 ? (
          <ul className="rounded-lg border border-line bg-surface px-3">
            {search.items.map((food) => (
              <ResultItem key={food.id} food={food} from={location.search} />
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
      </div>
    </div>
  )
}
