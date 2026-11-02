// Cliente con la clave de servicio. SOLO servidor: nunca importar desde el frontend.
import { createClient } from '@supabase/supabase-js'

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Cliente con la clave pública. Sirve para comprobar una contraseña sin usar la clave de servicio. */
export function anonClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key) throw new Error('Falta SUPABASE_URL o SUPABASE_ANON_KEY en el servidor')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
