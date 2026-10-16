import { supabase } from '../../lib/supabase'

export interface Profile {
  user_id: string
  birth_date: string | null
  sex: 'female' | 'male' | null
  height_cm: number | null
  timezone: string | null
  unit_system: 'metric'
  privacy_notice_version: string
  privacy_notice_accepted_at: string
  email_verified_at: string | null
  last_active_at: string
  created_at: string
  updated_at: string
}

/** Columnas que el cliente puede modificar (el resto está protegido por privilegios de columna). */
export interface ProfileUpdate {
  birth_date: string | null
  sex: 'female' | 'male' | null
  height_cm: number | null
  timezone: string | null
}

/** Devuelve el perfil propio. RLS garantiza que solo existe el de la cuenta actual (FR-010). */
export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle<Profile>()
  if (error) throw error
  return data
}

export async function updateProfile(values: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .select('*')
    .single<Profile>()
  if (error) throw error
  return data
}
