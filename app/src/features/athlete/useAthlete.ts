import { useQuery } from '@tanstack/react-query'
import { fetchAthlete } from './api'

export const athleteKey = ['athlete'] as const

/** El perfil de atleta de la persona: objetivos, disponibilidad, preferencias y su historial. */
export function useAthlete() {
  return useQuery({ queryKey: athleteKey, queryFn: fetchAthlete })
}
