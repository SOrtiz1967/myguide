import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { purgeAllDrafts } from '../../lib/drafts'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthState } from './authContext'

type Snapshot = Pick<AuthState, 'status' | 'session' | 'expired'>

const SESSION_EXPIRED = /session_expired/i

/**
 * Mantiene la sesión y aplica el vencimiento por inactividad de 30 días (FR-003): al abrir la app y
 * al renovar el token marca actividad con `touch_session`; si el servidor responde `session_expired`,
 * cierra la sesión y deja el aviso. Un error de red NO cierra la sesión.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    status: 'loading',
    session: null,
    expired: false,
  })

  /** Devuelve false si la sesión venció (y ya la cerró). */
  const markActivity = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.rpc('touch_session')
    if (error && SESSION_EXPIRED.test(error.message)) {
      purgeAllDrafts() // FR-022: no queda nada privado en el dispositivo
      setSnapshot({ status: 'signedOut', session: null, expired: true })
      await supabase.auth.signOut()
      return false
    }
    return true
  }, [])

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (!data.session) {
        setSnapshot((prev) => ({ status: 'signedOut', session: null, expired: prev.expired }))
        return
      }
      if (await markActivity()) {
        if (active) setSnapshot({ status: 'signedIn', session: data.session, expired: false })
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        purgeAllDrafts() // también cubre cierres hechos desde otra pestaña o por cambio de contraseña
        setSnapshot((prev) => ({ status: 'signedOut', session: null, expired: prev.expired }))
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSnapshot({ status: 'signedIn', session, expired: false })
        void markActivity()
      } else if (event === 'SIGNED_IN' && session) {
        setSnapshot({ status: 'signedIn', session, expired: false })
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [markActivity])

  const signOut = useCallback(async () => {
    purgeAllDrafts() // FR-022
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthState>(() => ({ ...snapshot, signOut }), [snapshot, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
