import { es } from '../../../copy/es'

/** Pantalla provisional de las rutas del registro; cada historia la reemplaza por la real. */
export function MealsPlaceholderPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.meals.title}</h1>
    </div>
  )
}
