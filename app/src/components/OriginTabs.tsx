import { useRef, type KeyboardEvent } from 'react'
import { RESULTS_PANEL_ID, tabId } from './tabIds'

export type OriginScope = 'all' | 'catalog' | 'own'

const SCOPES: readonly OriginScope[] = ['all', 'catalog', 'own']

/**
 * Pestañas de origen (todos, del catálogo, propios) con rol y estado accesibles; se recorren con las
 * flechas, Inicio y Fin. Las usan la búsqueda de alimentos y la de ejercicios, cada una con sus etiquetas.
 */
export function OriginTabs({
  value,
  onChange,
  labels,
  ariaLabel,
}: {
  value: OriginScope
  onChange: (scope: OriginScope) => void
  labels: Record<OriginScope, string>
  ariaLabel: string
}) {
  const TABS = SCOPES.map((scope) => ({ scope, label: labels[scope] }))
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1
    let next: number | null = null
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    const target = TABS[next]
    if (!target) return
    event.preventDefault()
    onChange(target.scope)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {TABS.map((tab, index) => {
        const selected = tab.scope === value
        return (
          <button
            key={tab.scope}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="tab"
            id={tabId(tab.scope)}
            aria-selected={selected}
            aria-controls={RESULTS_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.scope)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 py-2 font-medium ${
              selected ? 'border-accent text-ink' : 'border-transparent text-muted'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
