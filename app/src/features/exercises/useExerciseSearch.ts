import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { catalogHasExercises, searchExercises, type SearchScope } from './api'
import { isEquipment, isMuscle, type Equipment, type Muscle } from './exerciseLists'

export const SEARCH_PAGE_SIZE = 20
export const MIN_QUERY_LENGTH = 2
export const DEBOUNCE_MS = 300

// La pestaña, el texto y los filtros viven en la URL (`?q=&origen=&musculo=&equipo=`), así que sobreviven a
// ir al detalle y volver (FR-012).
const SCOPE_BY_PARAM: Record<string, SearchScope> = { catalogo: 'catalog', propios: 'own' }
const PARAM_BY_SCOPE: Record<SearchScope, string | null> = {
  all: null,
  catalog: 'catalogo',
  own: 'propios',
}

export function scopeFromParam(param: string | null): SearchScope {
  return (param && SCOPE_BY_PARAM[param]) || 'all'
}

/** Texto, pestaña, filtros y tandas acumuladas de la búsqueda, sincronizados con la URL. */
export function useExerciseSearch() {
  const [params, setParams] = useSearchParams()
  const scope = scopeFromParam(params.get('origen'))
  const urlText = params.get('q') ?? ''
  // Un filtro de la URL que no está en la lista se ignora.
  const muscleParam = params.get('musculo')
  const muscle: Muscle | null = muscleParam && isMuscle(muscleParam) ? muscleParam : null
  const equipmentParam = params.get('equipo')
  const equipment: Equipment | null =
    equipmentParam && isEquipment(equipmentParam) ? equipmentParam : null

  const [text, setText] = useState(urlText)
  const [query, setQuery] = useState(urlText.trim())

  // Espera 300 ms tras dejar de escribir antes de consultar y de actualizar la URL.
  useEffect(() => {
    const trimmed = text.trim()
    if (trimmed === query) return
    const timer = setTimeout(() => {
      setQuery(trimmed)
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (trimmed) next.set('q', trimmed)
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, query, setParams])

  function setParam(name: string, value: string | null) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(name, value)
        else next.delete(name)
        return next
      },
      { replace: true },
    )
  }

  const setScope = (next: SearchScope) => setParam('origen', PARAM_BY_SCOPE[next])
  const setMuscle = (next: Muscle | null) => setParam('musculo', next)
  const setEquipment = (next: Equipment | null) => setParam('equipo', next)
  const clearFilters = () =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('musculo')
        next.delete('equipo')
        return next
      },
      { replace: true },
    )

  // Con una sola letra se busca solo por los filtros, si los hay (FR-011).
  const effectiveQuery = query.length >= MIN_QUERY_LENGTH ? query : ''
  const hasFilters = muscle !== null || equipment !== null
  const enabled = effectiveQuery !== '' || hasFilters
  const tooShort = !enabled

  const search = useInfiniteQuery({
    queryKey: ['exercises', 'search', effectiveQuery, scope, muscle, equipment],
    queryFn: ({ pageParam }) =>
      searchExercises({
        q: effectiveQuery,
        scope,
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
  const total = items[0]?.total_estimate ?? 0
  const isEmpty = enabled && search.isSuccess && items.length === 0

  // Solo se pregunta si el catálogo está vacío cuando una búsqueda sin filtros no encontró nada.
  const catalog = useQuery({
    queryKey: ['exercises', 'catalog-has'],
    queryFn: catalogHasExercises,
    enabled: isEmpty && scope !== 'own' && !hasFilters,
  })

  return {
    text,
    setText,
    query,
    scope,
    setScope,
    muscle,
    setMuscle,
    equipment,
    setEquipment,
    hasFilters,
    clearFilters,
    tooShort,
    items,
    total,
    isEmpty,
    catalogEmpty: catalog.data === false,
    isLoading: enabled && search.isPending && !search.isError,
    isError: search.isError,
    error: search.error,
    refetch: () => void search.refetch(),
    hasNextPage: search.hasNextPage,
    isFetchingNextPage: search.isFetchingNextPage,
    fetchNextPage: () => void search.fetchNextPage(),
  }
}
