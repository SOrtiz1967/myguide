// T034 (FR-003): al abrir la app y al renovar el token se marca actividad; si la sesión venció, se cierra.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

let queryClient: QueryClient

function renderProvider() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignOutButton />
        </AuthProvider>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    await act(async () => {
      screen.getByRole('button', { name: 'salir' }).click()
    })
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalled()
  })
})

// T014 (spec 004, FR-029): la caché de consultas no puede mostrar datos de la cuenta anterior.
describe('AuthProvider: caché de consultas por sesión (FR-029)', () => {
  const OTHER = { access_token: 'jwt2', user: { id: 'u2', email: 'otra@ejemplo.com' } }

  beforeEach(() => {
    queryClient.setQueryData(['meals', 'day', '2026-10-19'], [{ food_name: 'Torta de A' }])
    queryClient.setQueryData(['goals', 'history'], [{ kcal: 2000 }])
  })

  it('al cerrar sesión la caché queda vacía', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    await screen.findByText(/estado:signedIn/)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
    await act(async () => {
      authListener('SIGNED_OUT', null)
    })
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('al vencer la sesión por inactividad la caché queda vacía', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    rpc.mockResolvedValue({ error: { message: 'session_expired: vencida' } })
    renderProvider()
    await screen.findByText(/estado:signedOut vencida:true/)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('al entrar con otra cuenta la caché queda vacía', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    await screen.findByText(/estado:signedIn/)
    await act(async () => {
      authListener('SIGNED_IN', OTHER)
    })
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('la misma cuenta que renueva el token o vuelve a entrar conserva la caché', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    await screen.findByText(/estado:signedIn/)
    await act(async () => {
      authListener('TOKEN_REFRESHED', SESSION)
      authListener('SIGNED_IN', SESSION)
    })
    expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
  })

  it('una consulta de la cuenta anterior que resuelve después del cierre no vuelve a llenar la caché', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    renderProvider()
    await screen.findByText(/estado:signedIn/)

    let finish: (value: string) => void = () => {}
    const pending = queryClient
      .fetchQuery({
        queryKey: ['meals', 'day', '2026-10-20'],
        queryFn: () => new Promise<string>((resolve) => (finish = resolve)),
      })
      .catch(() => 'cancelada')
    await act(async () => {
      authListener('SIGNED_OUT', null)
    })
    await act(async () => {
      finish('datos de A')
      await pending
    })
    expect(queryClient.getQueryData(['meals', 'day', '2026-10-20'])).toBeUndefined()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
