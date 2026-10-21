import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { searchExercises, type ExerciseSummary } from '../exercises/api'
import { ExerciseFilters } from '../exercises/ExerciseFilters'
import { measurementLabel, type Equipment, type Muscle } from '../exercises/exerciseLists'
import { DEBOUNCE_MS, MIN_QUERY_LENGTH, SEARCH_PAGE_SIZE } from '../exercises/useExerciseSearch'

const t = es.training.picker
const x = es.exercises

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])'

function originBadge(exercise: ExerciseSummary): string {
  if (exercise.origin === 'imported') return x.originBadge.catalog
  return exercise.based_on_exercise_id ? x.originBadge.copy : x.originBadge.own
}

interface ExercisePickerPanelProps {
  /** Se llama con el ejercicio elegido; quien lo abre decide si cierra el panel. */
  onPick: (exercise: ExerciseSummary) => void
  onClose: () => void
}

/**
 * Panel para elegir un ejercicio (propios y del catálogo) con la búsqueda de la spec 005. Es un diálogo modal
 * accesible: foco inicial en el campo de búsqueda, foco atrapado con Tab, Escape cierra y el foco vuelve a quien lo
 * abrió. La búsqueda vive en el estado del panel, no en la dirección, para no mezclarse con la de la página.
 */
export function ExercisePickerPanel({ onPick, onClose }: ExercisePickerPanelProps) {
  const titleId = useId()
  const overlay = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null>(null)

  useEffect(() => {
    input.current?.focus()
    const background = Array.from(document.body.children).filter(
      (element) => element !== overlay.current && !element.hasAttribute('inert'),
    )
    background.forEach((element) => element.setAttribute('inert', ''))
    return () => {
      background.forEach((element) => element.removeAttribute('inert'))
      opener?.focus?.()
    }
  }, [opener])

  // Espera tras dejar de escribir antes de consultar.
  useEffect(() => {
    const trimmed = text.trim()
    if (trimmed === query) return
    const timer = setTimeout(() => setQuery(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, query])

  const effectiveQuery = query.length >= MIN_QUERY_LENGTH ? query : ''
  const hasFilters = muscle !== null || equipment !== null
  const enabled = effectiveQuery !== '' || hasFilters

  const search = useInfiniteQuery({
    queryKey: ['exercises', 'picker', effectiveQuery, muscle, equipment],
    queryFn: ({ pageParam }) =>
      searchExercises({
        q: effectiveQuery,
        scope: 'all',
        muscle,
        equipment,
        pageSize: SEARCH_PAGE_SIZE,
        pageOffset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined,
    enabled,
  })
  const items = search.data?.pages.flat() ?? []
  const isEmpty = enabled && search.isSuccess && items.length === 0

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div ref={overlay} className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-line bg-surface p-5 text-ink"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {t.title}
          </h2>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.close}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${titleId}-q`} className="font-medium">
            {t.searchLabel}
          </label>
          <input
            ref={input}
            id={`${titleId}-q`}
            type="search"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
          />
        </div>

        <ExerciseFilters
          muscle={muscle}
          equipment={equipment}
          onMuscle={setMuscle}
          onEquipment={setEquipment}
        />

        {!enabled ? <p className="text-muted">{x.searchTooShort}</p> : null}
        {enabled && search.isPending && !search.isError ? (
          <LoadingState label={x.searching} />
        ) : null}
        {search.isError ? (
          <ErrorState
            message={isNetworkError(search.error) ? x.offlineSearch : x.searchError}
            onRetry={() => void search.refetch()}
          />
        ) : null}

        {isEmpty ? (
          <div className="flex flex-col gap-3">
            <EmptyState title={x.emptyTitle} description={x.emptyBody} />
            <Link
              to={`/ejercicios/nuevo${query ? `?nombre=${encodeURIComponent(query)}` : ''}`}
              className="btn-secondary self-start"
            >
              {t.createExercise}
            </Link>
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="rounded-lg border border-line px-3">
            {items.map((exercise) => (
              <li key={exercise.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onPick(exercise)}
                  className="flex min-h-11 w-full flex-col gap-0.5 px-1 py-3 text-left"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words font-medium">{exercise.name}</span>
                    <span className="shrink-0 rounded-full border border-line px-2 text-sm text-muted">
                      {originBadge(exercise)}
                    </span>
                  </span>
                  <span className="text-sm text-muted">
                    {measurementLabel(exercise.measurement_type)}
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
              onClick={() => void search.fetchNextPage()}
            >
              {search.isFetchingNextPage ? x.loadingMore : x.loadMore}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
