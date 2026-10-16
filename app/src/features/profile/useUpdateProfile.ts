import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProfile, type ProfileUpdate } from './api'
import { PROFILE_QUERY_KEY } from './useProfile'

/** Guarda el perfil. El dato nuevo solo reemplaza al guardado cuando el servidor lo confirma (FR-020). */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProfileUpdate) => updateProfile(values),
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_QUERY_KEY, profile),
  })
}
