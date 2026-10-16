// T060 (FR-023): el inicio guía a completar el perfil cuando faltan datos (estado vacío).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchProfile, type Profile } from '../../src/features/profile/api'
import { HomePage } from '../../src/routes/HomePage'

vi.mock('../../src/features/profile/api', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))

const mockedFetch = vi.mocked(fetchProfile)

const complete: Profile = {
  user_id: 'u1',
  birth_date: '1990-05-17',
  sex: null,
  height_cm: 171.5,
  timezone: 'America/Argentina/Buenos_Aires',
  unit_system: 'metric',
  privacy_notice_version: '2026-10-16',
  privacy_notice_accepted_at: '2026-10-16T12:00:00Z',
  email_verified_at: '2026-10-16T12:00:00Z',
  last_active_at: '2026-10-16T12:00:00Z',
  created_at: '2026-10-16T12:00:00Z',
  updated_at: '2026-10-16T12:00:00Z',
}

function renderHome(state?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomePage /> },
      { path: '/perfil', element: <h1>Pantalla de perfil</h1> },
    ],
    { initialEntries: [{ pathname: '/', state }] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(complete)
})

describe('HomePage', () => {
  it('FR-023: con el perfil incompleto muestra el estado vacío y lleva a completarlo', async () => {
    mockedFetch.mockResolvedValue({ ...complete, height_cm: null })
    renderHome()
    expect(await screen.findByRole('heading', { name: es.profile.emptyTitle })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.profile.emptyAction }))
    expect(await screen.findByRole('heading', { name: 'Pantalla de perfil' })).toBeVisible()
  })

  it('el sexo es opcional: un perfil sin sexo pero con lo demás cuenta como completo', async () => {
    renderHome()
    await screen.findByRole('heading', { level: 1, name: es.home.title })
    expect(screen.queryByRole('heading', { name: es.profile.emptyTitle })).toBeNull()
  })

  it('sin zona horaria o sin fecha de nacimiento también se considera incompleto', async () => {
    mockedFetch.mockResolvedValue({ ...complete, timezone: null })
    renderHome()
    expect(await screen.findByRole('heading', { name: es.profile.emptyTitle })).toBeVisible()
  })

  it('FR-026: avisa si el correo de confirmación no pudo enviarse al registrarse', async () => {
    renderHome({ verificationEmailSent: false })
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.verifyEmailNotSent)
  })
})
