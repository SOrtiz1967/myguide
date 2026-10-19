// FR-003 / FR-022: cerrar sesión desde la cabecera y avisar cuando la sesión venció por inactividad.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { LoginPage } from '../../src/features/auth/pages/LoginPage'
import { AppShell } from '../../src/components/AppShell'
import { RequireAuth } from '../../src/routes/RequireAuth'

const signedIn = (signOut = vi.fn().mockResolvedValue(undefined)): AuthState => ({
  status: 'signedIn',
  session: { access_token: 'jwt' } as never,
  expired: false,
  signOut,
})

describe('cabecera', () => {
  it('con sesión ofrece "Cerrar sesión" y la ejecuta', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    render(
      <AuthContext.Provider value={signedIn(signOut)}>
        <MemoryRouter>
          <AppShell>
            <p>contenido</p>
          </AppShell>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await userEvent.click(screen.getByRole('button', { name: es.auth.actions.logout }))
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('sin sesión no muestra "Cerrar sesión"', () => {
    render(
      <AuthContext.Provider
        value={{ status: 'signedOut', session: null, expired: false, signOut: async () => {} }}
      >
        <MemoryRouter>
          <AppShell>
            <p>contenido</p>
          </AppShell>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.queryByRole('button', { name: es.auth.actions.logout })).toBeNull()
  })

  it('spec 002: con sesión ofrece el enlace "Alimentos" hacia /alimentos', () => {
    render(
      <AuthContext.Provider value={signedIn()}>
        <MemoryRouter>
          <AppShell>
            <p>contenido</p>
          </AppShell>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByRole('link', { name: es.foods.navLink })).toHaveAttribute(
      'href',
      '/alimentos',
    )
  })

  it('spec 003: con sesión ofrece el enlace "Registro" hacia /comidas, antes de "Alimentos"', () => {
    render(
      <AuthContext.Provider value={signedIn()}>
        <MemoryRouter>
          <AppShell>
            <p>contenido</p>
          </AppShell>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const registro = screen.getByRole('link', { name: es.meals.navLink })
    expect(registro).toHaveAttribute('href', '/comidas')
    const alimentos = screen.getByRole('link', { name: es.foods.navLink })
    expect(
      registro.compareDocumentPosition(alimentos) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('spec 003: sin sesión no muestra el enlace "Registro"', () => {
    render(
      <AuthContext.Provider
        value={{ status: 'signedOut', session: null, expired: false, signOut: async () => {} }}
      >
        <MemoryRouter>
          <AppShell>
            <p>contenido</p>
          </AppShell>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.queryByRole('link', { name: es.meals.navLink })).toBeNull()
  })

  it('spec 002: sin sesión no muestra el enlace "Alimentos"', () => {
    render(
      <AuthContext.Provider
        value={{ status: 'signedOut', session: null, expired: false, signOut: async () => {} }}
      >
        <MemoryRouter>
          <AppShell>
            <p>contenido</p>
          </AppShell>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.queryByRole('link', { name: es.foods.navLink })).toBeNull()
  })
})

describe('sesión vencida', () => {
  it('FR-003: RequireAuth manda el aviso de vencimiento a la pantalla de ingreso', async () => {
    const router = createMemoryRouter(
      [
        { element: <RequireAuth />, children: [{ path: '/perfil', element: <h1>Privado</h1> }] },
        { path: '/ingresar', element: <LoginPage /> },
      ],
      { initialEntries: ['/perfil'] },
    )
    render(
      <AuthContext.Provider
        value={{ status: 'signedOut', session: null, expired: true, signOut: async () => {} }}
      >
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    )
    expect(await screen.findByText(es.auth.sessionExpired)).toBeVisible()
  })

  it('sin vencimiento no muestra el aviso', async () => {
    const router = createMemoryRouter(
      [
        { element: <RequireAuth />, children: [{ path: '/perfil', element: <h1>Privado</h1> }] },
        { path: '/ingresar', element: <LoginPage /> },
      ],
      { initialEntries: ['/perfil'] },
    )
    render(
      <AuthContext.Provider
        value={{ status: 'signedOut', session: null, expired: false, signOut: async () => {} }}
      >
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { name: es.auth.titles.login })
    expect(screen.queryByText(es.auth.sessionExpired)).toBeNull()
  })
})
