import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { WriteError } from '../../lib/mutation'
import { setWeeklyPlanDay } from './api'
import { useRoutines } from './useRoutines'
import { useWeeklyPlan, weeklyPlanQueryKey } from './useWeeklyPlan'

const p = es.training.weeklyPlan

/**
 * El plan semanal (spec 018): una rutina por día de la semana, que se repite todas las semanas. Cada cambio se guarda
 * al elegirlo y no toca ninguna sesión ya creada. Un día sin rutina es solo un día sin rutina.
 */
export function WeeklyPlanPanel() {
  const queryClient = useQueryClient()
  const plan = useWeeklyPlan()
  const routines = useRoutines()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const save = useMutation({
    mutationFn: ({ weekday, routineId }: { weekday: number; routineId: string | null }) =>
      setWeeklyPlanDay(weekday, routineId),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setMessage({ kind: 'ok', text: p.saved })
      void queryClient.invalidateQueries({ queryKey: weeklyPlanQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['training', 'week'] })
    },
    onError: (error) =>
      setMessage({
        kind: 'error',
        text: error instanceof WriteError ? error.message : p.saveFailed,
      }),
  })

  const loading = plan.isPending || routines.isPending
  const list = routines.data ?? []

  return (
    <section aria-labelledby="plan-semanal-titulo" className="card flex flex-col gap-3">
      <div>
        <h2 id="plan-semanal-titulo" className="text-lg font-extrabold">
          {p.title}
        </h2>
        <p className="text-sm text-muted">{p.intro}</p>
      </div>

      {loading ? <LoadingState /> : null}
      {plan.isError ? (
        <ErrorState message={p.loadError} onRetry={() => void plan.refetch()} />
      ) : null}
      {routines.isError ? (
        <ErrorState message={p.routinesError} onRetry={() => void routines.refetch()} />
      ) : null}

      {routines.isSuccess && list.length === 0 && plan.data?.every((d) => d.routine_id === null) ? (
        <EmptyState title={p.noRoutinesTitle} description={p.noRoutinesBody} />
      ) : null}

      {plan.isSuccess && routines.isSuccess ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {p.weekdays.map((name, index) => {
            const weekday = index + 1
            const row = plan.data.find((d) => d.weekday === weekday) ?? null
            const gone = row !== null && row.routine_id === null
            const selectId = `plan-dia-${weekday}`
            return (
              <li key={weekday} className="card-inset flex flex-col gap-1.5">
                <label htmlFor={selectId} className="text-sm font-bold">
                  {name}
                </label>
                <select
                  id={selectId}
                  className="control"
                  value={row?.routine_id ?? ''}
                  disabled={save.isPending}
                  onChange={(event) =>
                    save.mutate({ weekday, routineId: event.target.value || null })
                  }
                >
                  <option value="">{p.none}</option>
                  {list.map((routine) => (
                    <option key={routine.id} value={routine.id}>
                      {routine.name}
                    </option>
                  ))}
                </select>
                {gone ? (
                  <p className="text-sm text-muted">{p.goneRoutine(row.routine_name)}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/entrenamiento/rutinas/nueva" className="btn-secondary">
          {p.createRoutine}
        </Link>
        <p
          role="status"
          className={`text-sm ${message?.kind === 'error' ? 'text-danger' : 'text-muted'}`}
        >
          {message?.text ?? ''}
        </p>
      </div>
    </section>
  )
}
