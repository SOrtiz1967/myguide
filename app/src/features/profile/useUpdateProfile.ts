import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProfile, type ProfileUpdate } from './api'
import { PROFILE_QUERY_KEY } from './useProfile'

/**
 * Guarda el perfil. El dato nuevo solo reemplaza al guardado cuando el servidor lo confirma (FR-020).
 *  se ejecuta ANTES de publicar el dato nuevo: sirve para eliminar el borrador antes de que
 * la pantalla se vuelva a montar con el perfil actualizado.
 */
export function useUpdateProfile(options: { onSaved?: () => void } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProfileUpdate) => updateProfile(values),
    onSuccess: (profile) => {
      options.onSaved?.()
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile)
    },
  })
}
