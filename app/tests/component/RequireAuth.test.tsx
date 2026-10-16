// T046 (FR-012): una ruta privada sin sesión redirige a /ingresar sin cargar el contenido ni pedir datos.
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { RequireAuth } from '../../src/routes/RequireAuth'

function renderAt(state: AuthState, spy = vi.fn()) {
  // Un componente real: `spy` solo se invoca si la ruta privada llega a montarse.
  function PrivatePage() {
    spy()
    return <h1>Contenido privado</h1>
  }
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: '/perfil', element: <PrivatePage /> }],
      },
      { path: '/ingresar', element: <h1>Pantalla de ingreso</h1> },
    ],
    { initialEntries: ['/perfil'] },
  )
  render(
    <AuthContext.Provider value={state}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return { router, spy }
}

const base: AuthState = {
  status: 'signedOut',
  session: null,
  expired: false,
  signOut: async () => {},
}

describe('RequireAuth', () => {
  it('FR-012: sin sesión redirige a /ingresar y NO monta el contenido privado', async () => {
    const { router, spy } = renderAt(base)
    expect(await screen.findByRole('heading', { name: 'Pantalla de ingreso' })).toBeVisible()
    expect(screen.queryByText('Contenido privado')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/ingresar')
  })

  it('mientras se resuelve la sesión muestra la carga y no redirige', () => {
    const { spy } = renderAt({ ...base, status: 'loading' })
    expect(screen.getByRole('status')).toBeVisible()
    expect(screen.queryByText('Pantalla de ingreso')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('con sesión muestra el contenido privado', async () => {
    renderAt({ ...base, status: 'signedIn', session: { access_token: 'jwt' } as never })
    expect(await screen.findByRole('heading', { name: 'Contenido privado' })).toBeVisible()
  })

  it('recuerda a dónde quería ir para volver después de ingresar', async () => {
    const { router } = renderAt(base)
    await screen.findByText('Pantalla de ingreso')
    expect(router.state.location.state).toMatchObject({ from: '/perfil' })
  })
})
