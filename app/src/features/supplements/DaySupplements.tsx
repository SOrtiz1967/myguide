import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { WriteError } from '../../lib/mutation'
import { HomeSection } from '../home/HomeSection'
import { setSupplementTaken } from './api'
import { supplementsKey, useMarks, useSupplements } from './useSupplements'

const copy = es.supplements.day

/**
 * Los suplementos del día elegido (spec 022): cada uno con su estado en texto y forma, «Tomado» o «Sin registro», y una
 * casilla para marcarlo. Los archivados solo aparecen si tienen una marca ese día. Un día futuro no se puede marcar.
 */
export function DaySupplements({ date, today }: { date: string; today: string }) {
  const queryClient = useQueryClient()
  const list = useSupplements()
  const marks = useMarks(date)
  const [error, setError] = useState<string | null>(null)
  const future = date > today

  const toggle = useMutation({
    mutationFn: ({ id, taken }: { id: string; taken: boolean }) =>
      setSupplementTaken(id, date, taken),
    onMutate: () => setError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplementsKey }),
    onError: (e) => setError(e instanceof WriteError ? e.message : copy.saveFailed),
  })

  const taken = new Set(marks.data ?? [])
  const visible = (list.data ?? []).filter((s) => s.archived_at === null || taken.has(s.id))
  const pending = toggle.isPending ? toggle.variables?.id : null

  return (
    <HomeSection title={copy.title} className="md:col-span-2 lg:col-span-4">
      {list.isPending || marks.isPending ? <LoadingState /> : null}
      {list.isError || marks.isError ? (
        <ErrorState
          message={es.home.loadError}
          onRetry={() => {
            void list.refetch()
            void marks.refetch()
          }}
        />
      ) : null}

      {list.isSuccess && marks.isSuccess && visible.length === 0 ? (
        <p className="text-muted">
          {copy.empty}{' '}
          <Link to="/suplementos" className="underline">
            {copy.manage}
          </Link>
        </p>
      ) : null}

      {list.isSuccess && marks.isSuccess && visible.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((supplement) => {
              const isTaken = taken.has(supplement.id)
              const statusId = `supl-${supplement.id}-estado`
              return (
                <li key={supplement.id} className="card-inset flex flex-col gap-1">
                  <label className="flex min-h-11 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 accent-accent"
                      checked={isTaken}
                      disabled={future || pending === supplement.id}
                      aria-describedby={statusId}
                      onChange={(event) =>
                        toggle.mutate({ id: supplement.id, taken: event.target.checked })
                      }
                    />
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{supplement.name}</span>
                      {supplement.dose ? (
                        <span className="text-muted"> · {supplement.dose}</span>
                      ) : null}
                      {supplement.archived_at ? (
                        <span className="text-muted"> ({copy.archived})</span>
                      ) : null}
                    </span>
                  </label>
                  <p id={statusId} className="pl-8 text-sm text-muted">
                    <span aria-hidden="true">{isTaken ? '● ' : '○ '}</span>
                    {isTaken ? copy.taken : copy.none}
                  </p>
                </li>
              )
            })}
          </ul>
          {future ? <p className="text-sm text-muted">{copy.future}</p> : null}
          <p className="text-sm">
            <Link to="/suplementos" className="underline">
              {copy.manage}
            </Link>
          </p>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="notice-error px-4 py-3">
          {error}
        </p>
      ) : null}
    </HomeSection>
  )
}
