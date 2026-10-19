import { detectDeviceTimezone } from '../../lib/timezone'
import { useProfile } from '../profile/useProfile'
import { todayIn } from './meals'

/**
 * "Hoy" en la zona horaria del perfil (FR-024); mientras el perfil carga, o si no tiene zona, la del
 * dispositivo. El día de un ítem queda fijado al guardarlo, así que un cambio de zona no lo mueve.
 */
export function useToday(): string {
  const { data: profile } = useProfile()
  return todayIn(profile?.timezone ?? detectDeviceTimezone())
}
