import { useQuery } from '@tanstack/react-query'
import { fetchLastPhotoDate, fetchReminders } from './api'

export const remindersKey = ['reminders'] as const

/** Los recordatorios configurados de la persona. */
export function useReminders() {
  return useQuery({ queryKey: [...remindersKey, 'list'], queryFn: fetchReminders })
}

/** La fecha de la última foto de progreso; solo se pide si hace falta. */
export function useLastPhotoDate(enabled: boolean) {
  return useQuery({
    queryKey: [...remindersKey, 'last-photo'],
    queryFn: fetchLastPhotoDate,
    enabled,
  })
}
