import { Link } from 'react-router'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import type { Food } from './api'

/** Procedencia: del catálogo (fuente, código, fecha) o propio (con su original si es una copia). FR-011. */
export function FoodProvenance({ food }: { food: Food }) {
  return (
    <section aria-labelledby="procedencia-titulo">
      <h2 id="procedencia-titulo" className="text-lg font-semibold">
        {es.foods.provenance.title}
      </h2>
      {food.origin === 'imported' ? (
        <>
          <p className="mt-2">
            {es.foods.provenance.catalog(
              food.source?.name ?? '',
              food.source_item_id ?? '',
              food.imported_at ? formatDate(food.imported_at.slice(0, 10)) : '',
            )}
          </p>
          <p className="mt-1">
            <Link to="/fuentes" className="underline">
              {es.foods.provenance.viewSources}
            </Link>
          </p>
        </>
      ) : food.based_on ? (
        <p className="mt-2">
          {es.foods.provenance.ownBasedOnPrefix}{' '}
          <Link to={`/alimentos/${food.based_on.id}`} className="underline">
            {food.based_on.name}
          </Link>
        </p>
      ) : (
        <p className="mt-2">{es.foods.provenance.own}</p>
      )}
    </section>
  )
}
