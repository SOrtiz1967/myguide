import { useQuery } from '@tanstack/react-query'
import { fetchMarks, fetchSupplements } from './api'

export const supplementsKey = ['supplements'] as const

/** La lista de suplementos de la persona (sin archivar y archivados). */
export function useSupplements() {
  return useQuery({ queryKey: [...supplementsKey, 'list'], queryFn: fetchSupplements })
}

/** Los suplementos marcados como tomados en un día. */
export function useMarks(date: string) {
  return useQuery({ queryKey: [...supplementsKey, 'marks', date], queryFn: () => fetchMarks(date) })
}
