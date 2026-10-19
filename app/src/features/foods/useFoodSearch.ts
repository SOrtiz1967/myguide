import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { catalogHasFoods, searchFoods, type SearchScope } from './api'

export const SEARCH_PAGE_SIZE = 20
export const MIN_QUERY_LENGTH = 2
export const DEBOUNCE_MS = 300

// La pestaña activa vive en la URL (`?origen=`), así que sobrevive a ir al detalle y volver (FR-033).
const SCOPE_BY_PARAM: Record<string, SearchScope> = { catalogo: 'catalog', propios: 'own' }
const PARAM_BY_SCOPE: Record<SearchScope, string | null> = {
  all: null,
  catalog: 'catalogo',
  own: 'propios',
}

export function scopeFromParam(param: string | null): SearchScope {
  return (param && SCOPE_BY_PARAM[param]) || 'all'
}

/** Texto, pestaña y tandas acumuladas de la búsqueda, sincronizados con la URL (`?q=&origen=`). */
export function useFoodSearch() {
  const [params, setParams] = useSearchParams()
  const scope = scopeFromParam(params.get('origen'))
  const urlText = params.get('q') ?? ''

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

  function setScope(next: SearchScope) {
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous)
        const value = PARAM_BY_SCOPE[next]
        if (value) updated.set('origen', value)
        else updated.delete('origen')
        return updated
      },
      { replace: true },
    )
  }

  const tooShort = query.length < MIN_QUERY_LENGTH

  const search = useInfiniteQuery({
    queryKey: ['foods', 'search', query, scope],
    queryFn: ({ pageParam }) =>
      searchFoods({ q: query, scope, pageSize: SEARCH_PAGE_SIZE, pageOffset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined,
    enabled: !tooShort,
  })

  const items = search.data?.pages.flat() ?? []
  const total = items[0]?.total_estimate ?? 0
  const isEmpty = !tooShort && search.isSuccess && items.length === 0

  // Solo se pregunta si el catálogo está vacío cuando una búsqueda no encontró nada.
  const catalog = useQuery({
    queryKey: ['foods', 'catalog-has'],
    queryFn: catalogHasFoods,
    enabled: isEmpty && scope !== 'own',
  })

  return {
    text,
    setText,
    query,
    scope,
    setScope,
    tooShort,
    items,
    total,
    isEmpty,
    catalogEmpty: catalog.data === false,
    isLoading: !tooShort && search.isPending && !search.isError,
    isError: search.isError,
    error: search.error,
    refetch: () => void search.refetch(),
    hasNextPage: search.hasNextPage,
    isFetchingNextPage: search.isFetchingNextPage,
    fetchNextPage: () => void search.fetchNextPage(),
  }
}
