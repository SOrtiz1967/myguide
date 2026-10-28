// Spec 014, FR-001: sin el recorrido completo no se abre ninguna ruta privada.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchProfile, type Profile } from '../../src/features/profile/api'
import { RequireOnboarding } from '../../src/routes/RequireOnboarding'

vi.mock('../../src/features/profile/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/profile/api')>()),
  fetchProfile: vi.fn(),
}))

const profile = (completed: string | null): Profile => ({
  user_id: 'u1',
  birth_date: null,
  sex: null,
  height_cm: null,
  timezone: null,
  unit_system: 'metric',
  goal_type: null,
  experience: null,
  job_activity: null,
  training_days: null,
  onboarding_completed_at: completed,
  weight_reminder: false,
  privacy_notice_version: '1',
  privacy_notice_accepted_at: '2026-10-20T00:00:00Z',
  email_verified_at: null,
  last_active_at: '2026-10-20T00:00:00Z',
  created_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-20T00:00:00Z',
})

function renderGuard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/medidas']}>
        <Routes>
          <Route path="/bienvenida" element={<p>pantalla de bienvenida</p>} />
          <Route element={<RequireOnboarding />}>
            <Route path="/medidas" element={<p>pantalla privada</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.clearAllMocks())

describe('RequireOnboarding', () => {
  it('manda a la bienvenida si el recorrido está pendiente', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile(null))
    renderGuard()
    expect(await screen.findByText('pantalla de bienvenida')).toBeInTheDocument()
    expect(screen.queryByText('pantalla privada')).not.toBeInTheDocument()
  })

  it('muestra la ruta si el recorrido está completo', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile('2026-10-27T10:00:00Z'))
    renderGuard()
    expect(await screen.findByText('pantalla privada')).toBeInTheDocument()
  })

  it('si el perfil no carga muestra el error y no redirige', async () => {
    vi.mocked(fetchProfile).mockRejectedValue(new Error('x'))
    renderGuard()
    expect(await screen.findByText(es.onboarding.loadError)).toBeInTheDocument()
    expect(screen.queryByText('pantalla de bienvenida')).not.toBeInTheDocument()
  })
})
