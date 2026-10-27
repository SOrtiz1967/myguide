import { saveRemotely } from '../../lib/mutation'
import { saveGoal } from '../goals/api'
import { saveMeasurement } from '../measures/api'
import { parseMeasure } from '../measures/measures'
import { updateProfile, type Profile } from '../profile/api'
import { onboardingErrorMessage, toProfileUpdate, type OnboardingValues } from './onboarding'

interface CompleteInput {
  values: OnboardingValues
  /** Objetivo calórico elegido, o nulo si la persona lo deja para después. */
  kcal: number | null
  today: string
  timezone: string
  requestIds: { weight: string; goal: string }
}

/**
 * Guarda el recorrido: primero el peso y el objetivo, y al final el perfil con la marca de completado.
 * Si algo falla, la marca no queda puesta y reintentar es seguro: el peso y el objetivo son
 * idempotentes por identificador de solicitud.
 */
export async function completeOnboarding(input: CompleteInput): Promise<Profile> {
  const weight = parseMeasure('weight', input.values.weightKg)
  if (typeof weight === 'string') throw new Error(weight)
  await saveMeasurement(
    { kind: 'weight', value: weight, measuredOn: input.today, note: '' },
    input.requestIds.weight,
  )
  if (input.kcal !== null) await saveGoal(input.kcal, input.requestIds.goal)
  return saveRemotely(
    () => updateProfile(toProfileUpdate(input.values, input.timezone, new Date().toISOString())),
    onboardingErrorMessage,
  )
}
