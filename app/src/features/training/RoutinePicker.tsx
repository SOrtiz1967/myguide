import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import type { StartErrorState } from './useStartFromRoutine'
import { useStartFromRoutine } from './useStartFromRoutine'
import { useRoutines } from './useRoutines'

const h = es.training.home

/** Los errores de empezar una sesión, con la opción de continuar la que ya está abierta. */
export function StartError({ error }: { error: StartErrorState | null }) {
  if (!error) return null
  return (
    <div className="flex flex-col gap-3">
      <ErrorState message={error.message} />
      {error.openId ? (
        <div>
          <Link to={`/entrenamiento/sesion/${error.openId}`} className="btn-secondary">
            {h.continue}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

/** La lista de rutinas de la persona para empezar a entrenar con una. */
export function RoutinePicker() {
  const { data, isPending, isError, refetch } = useRoutines()
  const { start, pending, error } = useStartFromRoutine()

  return (
    <section aria-labelledby="empezar-rutina-titulo" className="flex flex-col gap-3">
      <h3 id="empezar-rutina-titulo" className="text-lg font-semibold">
        {h.startFromRoutine}
      </h3>
      {isPending ? <LoadingState /> : null}
      {isError ? (
        <ErrorState message={es.training.routines.loadError} onRetry={() => void refetch()} />
      ) : null}
      {data && data.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted">{h.noRoutines}</p>
          <div>
            <Link to="/entrenamiento/rutinas/nueva" className="btn-secondary">
              {h.createRoutine}
            </Link>
          </div>
        </div>
      ) : null}
      {data && data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                className="btn-secondary w-full justify-between text-left"
                disabled={pending}
                onClick={() => start(routine.id)}
              >
                <span className="break-words">{h.startWith(routine.name)}</span>
                <span className="text-sm text-muted">
                  {es.training.routines.exerciseCount(routine.routine_exercises.length)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <StartError error={error} />
    </section>
  )
}
