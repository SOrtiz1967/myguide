import { es } from '../../copy/es'
import { markWorkoutDone } from './api'
import { useRequestIds, useTrainingAction } from './useTrainingAction'

/**
 * Marcar como completado el entrenamiento de una rutina en un día (spec 018). `date` nulo es hoy. Un identificador por
 * rutina y día: un doble toque o un reintento no crea otra sesión (FR-010).
 */
export function useMarkWorkoutDone(date: string | null) {
  const ids = useRequestIds()
  const action = useTrainingAction(
    (routineId: string) =>
      markWorkoutDone(routineId, date, ids.idFor(`done:${routineId}:${date ?? 'hoy'}`)),
    { failure: es.training.today.markFailed },
  )
  return { mark: action.run, pending: action.pending, error: action.error }
}
