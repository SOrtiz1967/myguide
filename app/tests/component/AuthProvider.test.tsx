// T034 (FR-003): al abrir la app y al renovar el token se marca actividad; si la sesión venció, se cierra.
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/features/auth/AuthProvider'
import { useAuth } from '../../src/features/auth/useAuth'

const auth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}
const rpc = vi.fn()
let authListener: (event: string, session: unknown) => void = () => {}
const unsubscribe = vi.fn()

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => auth.getSession(),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authListener = cb
        return { data: { subscription: { unsubscribe } } }
      },
      signOut: (opts?: unknown) => auth.signOut(opts),
    },
    rpc: (name: string) => rpc(name),
  },
  publicEnv: {},
}))

const SESSION = { access_token: 'jwt', user: { id: 'u1', email: 'persona@ejemplo.com' } }

function Probe() {
  const { status, expired } = useAuth()
  return (
    <p>
      estado:{status} vencida:{String(expired)}
    </p>
  )
}

function SignOutButton() {
  const { signOut } = useAuth()
  return (
    <button type="button" onClick={() => void signOut()}>
      salir
    </button>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

beforeEach(() => {
  auth.getSession.mockReset()
  auth.signOut.mockReset().mockResolvedValue({ error: null })
  rpc.mockReset().mockResolvedValue({ error: null })
  unsubscribe.mockReset()
})

describe('AuthProvider', () => {
  it('sin sesión queda como "signedOut" y no marca actividad', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    renderProvider()
    expect(await screen.findByText(/estado:signedOut/)).toBeVisible()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('FR-003: con sesión marca actividad con touch_session al abrir la app', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    expect(await screen.findByText(/estado:signedIn/)).toBeVisible()
    expect(rpc).toHaveBeenCalledWith('touch_session')
  })

  it('FR-003: si la sesión venció (session_expired) la cierra y avisa', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    rpc.mockResolvedValue({
      error: { message: 'session_expired: la sesion vencio por inactividad' },
    })
    renderProvider()
    expect(await screen.findByText(/estado:signedOut vencida:true/)).toBeVisible()
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('FR-003: al renovarse el token vuelve a marcar actividad', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    await screen.findByText(/estado:signedIn/)
    rpc.mockClear()
    await act(async () => {
      authListener('TOKEN_REFRESHED', SESSION)
    })
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('touch_session'))
  })

  it('un cierre de sesión pasa a "signedOut"', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    await screen.findByText(/estado:signedIn/)
    await act(async () => {
      authListener('SIGNED_OUT', null)
    })
    expect(await screen.findByText(/estado:signedOut/)).toBeVisible()
  })

  it('al desmontarse cancela la suscripción', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    const { unmount } = renderProvider()
    await screen.findByText(/estado:signedOut/)
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('AuthProvider: borradores locales (FR-022)', () => {
  const KEY = 'draft:v1:u1:profile'

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(KEY, JSON.stringify({ savedAt: 1, values: {} }))
    localStorage.setItem('tema', 'oscuro')
  })

  it('FR-022: al vencer la sesión por inactividad elimina todos los borradores', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    rpc.mockResolvedValue({ error: { message: 'session_expired: vencida' } })
    renderProvider()
    await screen.findByText(/estado:signedOut vencida:true/)
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(localStorage.getItem('tema')).toBe('oscuro')
  })

  it('FR-022: al cerrar sesión elimina todos los borradores', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    await screen.findByText(/estado:signedIn/)
    await act(async () => {
      authListener('SIGNED_OUT', null)
    })
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull())
  })

  it('FR-022: el cierre de sesión explícito purga antes de cerrar', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    )
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    await act(async () => {
      screen.getByRole('button', { name: 'salir' }).click()
    })
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalled()
  })
})
