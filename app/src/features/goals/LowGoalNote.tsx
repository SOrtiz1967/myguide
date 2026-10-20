import { es } from '../../copy/es'

/**
 * Nota informativa para un objetivo menor a 1.200 kcal (spec 004, FR-005). Es una nota, no una alerta:
 * sin color de error ni ícono de advertencia, sin tono de orden y sin diagnóstico. El valor se guarda
 * igual: está dentro del rango admitido.
 */
export function LowGoalNote() {
  return (
    <p role="note" className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-muted">
      {es.goal.lowGoalNote}
    </p>
  )
}
