import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { es } from '../../copy/es'
import { searchExercises } from '../exercises/api'
import { searchFoods } from '../foods/api'

const t = es.athlete.preferences
const MIN_LENGTH = 2
const DEBOUNCE_MS = 300

interface Result {
  id: string
  name: string
}

/** Busca en el catálogo (ejercicios o alimentos) y devuelve el elegido; las preferencias se eligen siempre del catálogo. */
export function ItemPicker({
  source,
  taken,
  onPick,
}: {
  source: 'exercise' | 'food'
  taken: ReadonlySet<string>
  onPick: (item: Result) => void
}) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  const enabled = query.length >= MIN_LENGTH
  const { data, isFetching } = useQuery({
    queryKey: ['athlete-picker', source, query],
    enabled,
    queryFn: async (): Promise<Result[]> => {
      if (source === 'exercise') {
        const rows = await searchExercises({
          q: query,
          scope: 'all',
          muscle: null,
          equipment: null,
          pageSize: 8,
          pageOffset: 0,
        })
        return rows.map((row) => ({ id: row.id, name: row.name }))
      }
      const rows = await searchFoods({ q: query, scope: 'all', pageSize: 8, pageOffset: 0 })
      return rows.map((row) => ({ id: row.id, name: row.name }))
    },
  })

  const results = (data ?? []).filter((item) => !taken.has(item.id))

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">
          {source === 'exercise' ? t.searchExercise : t.searchFood}
        </span>
        <input
          type="search"
          className="control"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {text.trim().length > 0 && !enabled ? (
        <p className="text-sm text-muted">{t.searchMin}</p>
      ) : null}
      {enabled && !isFetching && results.length === 0 ? (
        <p className="text-sm text-muted">{t.searchEmpty}</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {results.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{item.name}</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onPick(item)
                  setText('')
                  setQuery('')
                }}
              >
                {t.add}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
