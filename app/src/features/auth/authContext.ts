import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

export interface AuthState {
  /** `loading` mientras se resuelve la sesión guardada; nunca se redirige hasta saberlo. */
  status: 'loading' | 'signedIn' | 'signedOut'
  session: Session | null
  /** true si la sesión se cerró porque venció por inactividad (FR-003). */
  expired: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
