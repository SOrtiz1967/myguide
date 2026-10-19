import { es } from '../../copy/es'
import type { Food } from './api'
import { basisLabel, formatValue, NUTRIENTS } from './nutrition'

type Values = Pick<
  Food,
  | 'reference_basis'
  | 'energy_kcal'
  | 'protein_g'
  | 'carbs_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sodium_mg'
>

/** Valores nutricionales con unidad y base de referencia; los faltantes dicen "sin dato" (FR-005, FR-006). */
export function NutritionFacts({ food }: { food: Values }) {
  return (
    <section aria-labelledby="valores-titulo">
      <h2 id="valores-titulo" className="text-lg font-semibold">
        {es.foods.nutrition.title}
      </h2>
      <table className="mt-2 w-full border-collapse text-left">
        <caption className="pb-2 text-left text-muted">{basisLabel(food.reference_basis)}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Nutriente</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {NUTRIENTS.map((nutrient) => {
            const value = food[nutrient.key]
            return (
              <tr key={nutrient.key} className="border-t border-line">
                <th
                  scope="row"
                  className={`py-2 pr-3 font-normal ${nutrient.indent ? 'pl-5 text-muted' : 'font-medium'}`}
                >
                  {es.foods.nutrition.labels[nutrient.key]}
                </th>
                <td
                  className={`py-2 text-right tabular-nums ${value === null ? 'text-muted' : ''}`}
                >
                  {formatValue(value, nutrient.unit)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
