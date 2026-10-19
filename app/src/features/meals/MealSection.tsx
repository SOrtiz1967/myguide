import { Link } from 'react-router'
import { es } from '../../copy/es'
import { formatValue, type Unit } from '../foods/nutrition'
import type { MealEntry } from './api'
import { entryQuantityText } from './entryText'
import { mealLabel, type Meal } from './meals'
import { formatTotal, TOTAL_KEYS, type Total, type TotalKey } from './mealTotals'

const UNITS: Record<TotalKey, Unit> = {
  energy_kcal: 'kcal',
  protein_g: 'g',
  carbs_g: 'g',
  fat_g: 'g',
}

/** Los valores de energía y macronutrientes, cada uno con su unidad y los faltantes marcados. */
export function TotalsList({ totals }: { totals: Record<TotalKey, Total> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
      {TOTAL_KEYS.map((key) => (
        <div key={key} className="flex flex-wrap justify-between gap-x-3">
          <dt className="text-muted">{es.meals.nutrients[key]}</dt>
          <dd className="tabular-nums">{formatTotal(totals[key], UNITS[key])}</dd>
        </div>
      ))}
    </dl>
  )
}

function EntryRow({ entry, date }: { entry: MealEntry; date: string }) {
  const quantity = entryQuantityText(entry)
  const gone = entry.food_id === null && (entry.origin === 'catalog' || entry.origin === 'own')
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={`/comidas/item/${entry.id}`}
        state={{ from: date }}
        className="flex min-h-11 flex-col gap-0.5 px-1 py-3"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0 truncate font-medium">{entry.food_name}</span>
          <span className="shrink-0 rounded-full border border-line px-2 text-sm text-muted">
            {es.meals.origin[entry.origin]}
          </span>
        </span>
        {entry.food_brand ? (
          <span className="block truncate text-muted">{entry.food_brand}</span>
        ) : null}
        <span className="text-sm text-muted">
          {[quantity, formatValue(entry.energy_kcal, 'kcal')].filter(Boolean).join(' · ')}
        </span>
        {entry.status === 'pending' ? (
          <>
            <span className="text-sm font-medium">{es.meals.pending}</span>
            <span className="text-sm text-muted">{es.meals.pendingNote}</span>
          </>
        ) : null}
        {gone ? <span className="text-sm text-muted">{es.meals.day.foodGone}</span> : null}
      </Link>
    </li>
  )
}

interface MealSectionProps {
  meal: Meal
  date: string
  entries: MealEntry[]
  subtotal: Record<TotalKey, Total>
  /** Contenido extra de la comida (por ejemplo, su foto). */
  extra?: React.ReactNode
}

export function MealSection({ meal, date, entries, subtotal, extra }: MealSectionProps) {
  const name = mealLabel(meal)
  return (
    <section
      aria-labelledby={`comida-${meal}`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`comida-${meal}`} className="text-lg font-semibold">
          {name}
        </h2>
        <Link
          to={`/comidas/${date}/agregar?comida=${meal}`}
          aria-label={es.meals.day.addTo(name)}
          className="btn-secondary"
        >
          {es.meals.day.add}
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted">{es.meals.day.mealEmpty}</p>
      ) : (
        <>
          <ul>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} date={date} />
            ))}
          </ul>
          <div
            role="group"
            aria-label={es.meals.day.subtotal}
            className="border-t border-line pt-3"
          >
            <TotalsList totals={subtotal} />
          </div>
        </>
      )}
      {extra}
    </section>
  )
}
