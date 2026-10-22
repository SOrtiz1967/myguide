import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { SessionInProgressError } from './api'
import type { StartErrorState } from './useStartFromRoutine'

/**
 * Una acción de planificación (planificar, mover, cancelar, empezar…). Evita lanzar dos a la vez, refresca los datos
 * de entrenamiento al terminar y deja un error con un mensaje seguro, nunca el texto crudo del servidor.
 */
export function useTrainingAction<V, R>(
  action: (variables: V) => Promise<R>,
  options: { failure: string; onSuccess?: (result: R, variables: V) => void },
) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<StartErrorState | null>(null)
  // Un doble clic llega antes de que la pantalla se vuelva a dibujar: el candado no puede depender del estado.
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationFn: action,
    onMutate: () => setError(null),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['training'] })
      options.onSuccess?.(result, variables)
    },
    onError: (e) =>
      setError(
        e instanceof SessionInProgressError
          ? { message: es.training.errors.sessionInProgress, openId: e.sessionId }
          : { message: e instanceof WriteError ? e.message : options.failure, openId: null },
      ),
  })
  return {
    run: (variables: V) => {
      if (inFlight.current) return
      inFlight.current = true
      mutation.mutate(variables)
    },
    pending: mutation.isPending,
    error,
    clearError: () => setError(null),
  }
}

/**
 * Un identificador por intención: reintentar la misma no crea otra cosa (FR-047). `reset` lo renueva cuando la
 * intención se cumplió y la persona quiere hacer otra igual.
 */
export function useRequestIds() {
  const [ids] = useState(() => new Map<string, string>())
  return {
    idFor: (key: string) => {
      let id = ids.get(key)
      if (!id) {
        id = newRequestId()
        ids.set(key, id)
      }
      return id
    },
    reset: (key: string) => void ids.delete(key),
  }
}
