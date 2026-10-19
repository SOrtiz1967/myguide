import { Navigate } from 'react-router'
import { useToday } from './useToday'

/** `/comidas` lleva al día de hoy (la regla del día que se está cerrando se suma en la historia 5). */
export function MealsRedirect() {
  const today = useToday()
  return <Navigate to={`/comidas/${today}`} replace />
}
