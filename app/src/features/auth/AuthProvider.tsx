import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { purgeAllDrafts } from '../../lib/drafts'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthState } from './authContext'

type Snapshot = Pick<AuthState, 'status' | 'session' | 'expired'>

const SESSION_EXPIRED = /session_expired/i

/**
 * Mantiene la sesión y aplica el vencimiento por inactividad de 30 días (FR-003): al abrir la app y
 * al renovar el token marca actividad con `touch_session`; si el servidor responde `session_expired`,
 * cierra la sesión y deja el aviso. Un error de red NO cierra la sesión.
 *
 * También vacía la caché de consultas al cerrar o vencer la sesión y al entrar otra cuenta (spec 004,
 * FR-029): las claves de caché no incluyen la cuenta, así que sin esto la segunda persona de un mismo
 * navegador vería, aunque fuera un instante, los datos de salud de la primera.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    status: 'loading',
    session: null,
    expired: false,
  })

  const queryClient = useQueryClient()
  const userId = useRef<string | null>(null)

  /** Cancela lo que está en curso (para que no vuelva a llenar la caché) y la vacía. */
  const clearCache = useCallback(() => {
    void queryClient.cancelQueries()
    queryClient.clear()
  }, [queryClient])

  /** Registra quién tiene la sesión; si es otra cuenta distinta de la anterior, vacía la caché. */
  const trackUser = useCallback(
    (session: Session | null) => {
      const next = session?.user.id ?? null
      if (userId.current !== null && next !== userId.current) clearCache()
      userId.current = next
    },
    [clearCache],
  )

  /** Devuelve false si la sesión venció (y ya la cerró). */
  const markActivity = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.rpc('touch_session')
    if (error && SESSION_EXPIRED.test(error.message)) {
      purgeAllDrafts() // FR-022: no queda nada privado en el dispositivo
      userId.current = null
      clearCache()
      setSnapshot({ status: 'signedOut', session: null, expired: true })
      await supabase.auth.signOut()
      return false
    }
    return true
  }, [clearCache])

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (!data.session) {
        setSnapshot((prev) => ({ status: 'signedOut', session: null, expired: prev.expired }))
        return
      }
      if (await markActivity()) {
        if (active) {
          trackUser(data.session)
          setSnapshot({ status: 'signedIn', session: data.session, expired: false })
        }
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        purgeAllDrafts() // también cubre cierres hechos desde otra pestaña o por cambio de contraseña
        userId.current = null
        clearCache()
        setSnapshot((prev) => ({ status: 'signedOut', session: null, expired: prev.expired }))
      } else if (event === 'TOKEN_REFRESHED' && session) {
        trackUser(session)
        setSnapshot({ status: 'signedIn', session, expired: false })
        void markActivity()
      } else if (event === 'SIGNED_IN' && session) {
        trackUser(session)
        setSnapshot({ status: 'signedIn', session, expired: false })
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [markActivity, trackUser, clearCache])

  const signOut = useCallback(async () => {
    purgeAllDrafts() // FR-022
    userId.current = null
    clearCache()
    await supabase.auth.signOut()
  }, [clearCache])

  const value = useMemo<AuthState>(() => ({ ...snapshot, signOut }), [snapshot, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
