import { useRef, type KeyboardEvent } from 'react'
import { es } from '../../copy/es'
import type { SearchScope } from './api'
import { RESULTS_PANEL_ID, tabId } from './tabIds'

const TABS: { scope: SearchScope; label: string }[] = [
  { scope: 'all', label: es.foods.tabs.all },
  { scope: 'catalog', label: es.foods.tabs.catalog },
  { scope: 'own', label: es.foods.tabs.own },
]

/** Pestañas con rol y estado accesibles; se recorren con las flechas, Inicio y Fin (FR-030). */
export function OriginTabs({
  value,
  onChange,
}: {
  value: SearchScope
  onChange: (scope: SearchScope) => void
}) {
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
      aria-label={es.foods.tabsLabel}
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
