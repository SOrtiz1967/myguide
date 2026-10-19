import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { es } from '../../copy/es'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { startLogDay, type DayStatus } from './api'
import { formatDay } from './meals'

/**
 * El día anterior todavía se está cerrando (FR-025): se dice con claridad en qué día se registra y se
 * ofrece empezar el de hoy. No es obligatorio ni tiene hora límite.
 */
export function ClosingDayNotice({ status }: { status: DayStatus }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const start = useMutation({
    mutationFn: () => saveRemotely(() => startLogDay(status.today)),
    onMutate: () => setError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meals'] })
      void navigate(`/comidas/${status.today}`)
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : es.errors.generic),
  })

  return (
    <section
      aria-label={es.meals.day.closing(formatDay(status.proposed_date))}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="text-lg font-semibold">
        {es.meals.day.closing(formatDay(status.proposed_date))}
      </h2>
      <p className="text-muted">{es.meals.day.closingHint}</p>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="button"
          className="btn-secondary"
          disabled={start.isPending}
          onClick={() => start.mutate()}
        >
          {es.meals.day.startToday}
        </button>
      </div>
    </section>
  )
}
