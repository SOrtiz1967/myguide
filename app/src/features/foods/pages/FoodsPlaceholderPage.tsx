import { es } from '../../../copy/es'

/** Pantalla provisional de las rutas de alimentos; cada historia la reemplaza por la real (T029, T037, T061, T064). */
export function FoodsPlaceholderPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.foods.title}</h1>
    </div>
  )
}
