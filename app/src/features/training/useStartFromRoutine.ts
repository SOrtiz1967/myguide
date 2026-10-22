import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { SessionInProgressError, startWorkoutFromRoutine } from './api'

const h = es.training.home

export interface StartErrorState {
  message: string
  /** La sesión que ya está abierta, para ofrecer continuarla. */
  openId: string | null
}

/**
 * Empezar una sesión con el plan de una rutina, con un solo gesto (FR-027a). Un identificador por rutina: reintentar
 * la misma no crea otra sesión (FR-047).
 */
export function useStartFromRoutine() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [requestIds] = useState(() => new Map<string, string>())
  const [error, setError] = useState<StartErrorState | null>(null)

  const mutation = useMutation({
    mutationFn: ({ routineId, requestId }: { routineId: string; requestId: string }) =>
      startWorkoutFromRoutine(routineId, null, requestId),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['training'] })
      void navigate(`/entrenamiento/sesion/${result.id}`)
    },
    onError: (e) =>
      setError(
        e instanceof SessionInProgressError
          ? { message: es.training.errors.sessionInProgress, openId: e.sessionId }
          : { message: e instanceof WriteError ? e.message : h.startFailed, openId: null },
      ),
  })

  function start(routineId: string) {
    if (mutation.isPending) return
    let requestId = requestIds.get(routineId)
    if (!requestId) {
      requestId = newRequestId()
      requestIds.set(routineId, requestId)
    }
    mutation.mutate({ routineId, requestId })
  }

  return { start, pending: mutation.isPending, error }
}
