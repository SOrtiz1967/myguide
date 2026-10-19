import { Navigate } from 'react-router'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { useDayStatus } from './useDayStatus'
import { useToday } from './useToday'

/** `/comidas` lleva al día propuesto: el que se está cerrando (FR-025) o, si no, hoy. */
export function MealsRedirect() {
  const today = useToday()
  const status = useDayStatus()
  if (status.isPending) return <LoadingState label={es.meals.day.loading} />
  return <Navigate to={`/comidas/${status.data?.proposed_date ?? today}`} replace />
}
