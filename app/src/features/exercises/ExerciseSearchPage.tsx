import { Link, useLocation, useNavigate } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { OriginTabs } from '../../components/OriginTabs'
import { SuccessMessage } from '../../components/SuccessMessage'
import { RESULTS_PANEL_ID, tabId } from '../../components/tabIds'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import type { ExerciseSummary } from './api'
import { ExerciseFilters } from './ExerciseFilters'
import { equipmentLabel, measurementLabel, muscleLabel } from './exerciseLists'
import { formatEquipment, formatMuscles } from './exerciseText'
import { useExerciseSearch } from './useExerciseSearch'

const t = es.exercises

function originBadge(exercise: ExerciseSummary): string {
  if (exercise.origin === 'imported') return t.originBadge.catalog
  return exercise.based_on_exercise_id ? t.originBadge.copy : t.originBadge.own
}

function ResultItem({ exercise, from }: { exercise: ExerciseSummary; from: string }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={`/ejercicios/${exercise.id}`}
        state={{ from }}
        className="flex min-h-11 flex-col gap-0.5 px-1 py-3"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0 truncate font-medium">{exercise.name}</span>
          <span className="shrink-0 rounded-full border border-line px-2 text-sm text-muted">
            {originBadge(exercise)}
          </span>
        </span>
        <span className="text-sm text-muted">{measurementLabel(exercise.measurement_type)}</span>
        <span className="text-sm text-muted">
          {formatMuscles(exercise.primary_muscles.slice(0, 1))} ·{' '}
          {formatEquipment(exercise.equipment)}
        </span>
      </Link>
    </li>
  )
}

export function ExerciseSearchPage() {
  const search = useExerciseSearch()
  const navigate = useNavigate()
  const location = useLocation()
  const deleted = (location.state as { deleted?: boolean } | null)?.deleted === true

  const createNamed = () =>
    void navigate(`/ejercicios/nuevo?nombre=${encodeURIComponent(search.query)}`)

  const activeFilters = [
    search.muscle ? muscleLabel(search.muscle) : null,
    search.equipment ? equipmentLabel(search.equipment) : null,
  ]
    .filter((label): label is string => label !== null)
    .join(', ')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <Link to="/ejercicios/nuevo" className="btn-secondary">
          {t.newExercise}
        </Link>
      </div>

      {deleted ? <SuccessMessage>{t.form.deleted}</SuccessMessage> : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="busqueda" className="font-medium">
          {t.searchLabel}
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

      <ExerciseFilters
        muscle={search.muscle}
        equipment={search.equipment}
        onMuscle={search.setMuscle}
        onEquipment={search.setEquipment}
      />

      <OriginTabs
        value={search.scope}
        onChange={search.setScope}
        labels={t.tabs}
        ariaLabel={t.tabsLabel}
      />

      <div
        id={RESULTS_PANEL_ID}
        role="tabpanel"
        aria-labelledby={tabId(search.scope)}
        className="flex flex-col gap-3"
      >
        <div aria-live="polite">
          {search.items.length > 0 ? (
            <p className="text-sm text-muted">{t.resultsCount(search.total)}</p>
          ) : null}
        </div>

        {search.tooShort ? <p className="text-muted">{t.searchTooShort}</p> : null}

        {search.isLoading ? <LoadingState label={t.searching} /> : null}

        {search.isError ? (
          <ErrorState
            message={isNetworkError(search.error) ? t.offlineSearch : t.searchError}
            onRetry={search.refetch}
          />
        ) : null}

        {search.isEmpty && search.hasFilters ? (
          <EmptyState
            title={t.emptyFiltersTitle}
            description={t.emptyFiltersBody(activeFilters)}
            actionLabel={t.clearFilters}
            onAction={search.clearFilters}
          />
        ) : null}

        {search.isEmpty && !search.hasFilters ? (
          <EmptyState
            title={
              search.catalogEmpty && search.scope === 'catalog' ? t.catalogEmpty : t.emptyTitle
            }
            description={t.emptyBody}
            actionLabel={t.createNamed(search.query)}
            onAction={createNamed}
          />
        ) : null}

        {search.items.length > 0 ? (
          <ul className="rounded-lg border border-line bg-surface px-3">
            {search.items.map((exercise) => (
              <ResultItem key={exercise.id} exercise={exercise} from={location.search} />
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
              {search.isFetchingNextPage ? t.loadingMore : t.loadMore}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
