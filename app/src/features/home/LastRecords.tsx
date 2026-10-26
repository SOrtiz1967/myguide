import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { markLabels } from '../training/trainingText'
import { HomeSection } from './HomeSection'
import { useLastMealEntry, useLastSession } from './useLastMealEntry'

const l = es.home.last

function MealRow() {
  const { data, isPending, isError, refetch } = useLastMealEntry()
  if (isPending) return <LoadingState />
  if (isError) return <ErrorState message={es.home.loadError} onRetry={() => void refetch()} />
  if (!data) return <p className="text-muted">{l.noMeal}</p>
  return (
    <Link to={`/comidas/item/${data.id}`} className="flex min-h-11 flex-col gap-0.5 underline">
      <span className="font-medium">{l.meal}</span>
      <span className="break-words text-sm text-muted">
        {l.mealLine(data.food_name, es.meals.names[data.meal], formatDate(data.log_date))}
      </span>
    </Link>
  )
}

function SessionRow() {
  const { data, isPending, isError, refetch } = useLastSession()
  if (isPending) return <LoadingState />
  if (isError) return <ErrorState message={es.home.loadError} onRetry={() => void refetch()} />
  if (!data) return <p className="text-muted">{l.noSession}</p>
  const marks = markLabels(data)
  return (
    <Link
      to={`/entrenamiento/sesion/${data.id}`}
      className="flex min-h-11 flex-col gap-0.5 underline"
    >
      <span className="font-medium">{l.session}</span>
      <span className="break-words text-sm text-muted">
        {[l.sessionLine(formatDate(data.session_date), data.routine_name), ...marks].join(' · ')}
      </span>
    </Link>
  )
}

/** Lo último que se registró: el ítem de comida más reciente y la última sesión realizada, con su fecha. */
export function LastRecords() {
  return (
    <HomeSection title={l.title}>
      <ul className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <li>
          <MealRow />
        </li>
        <li>
          <SessionRow />
        </li>
      </ul>
    </HomeSection>
  )
}
