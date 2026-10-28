// T063 (FR-021, FR-022): el formulario del perfil recupera lo que se estaba escribiendo.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchProfile, updateProfile, type Profile } from '../../src/features/profile/api'
import { ProfilePage } from '../../src/features/profile/ProfilePage'
import { detectDeviceTimezone } from '../../src/lib/timezone'

vi.mock('../../src/features/profile/api', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))
vi.mock('../../src/lib/timezone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/timezone')>()),
  detectDeviceTimezone: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchProfile)
const mockedUpdate = vi.mocked(updateProfile)

const BA = 'America/Argentina/Buenos_Aires'
const KEY = 'draft:v1:u1:profile'

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 'u1',
    birth_date: '1990-05-17',
    sex: 'female',
    height_cm: 171.5,
    timezone: BA,
    unit_system: 'metric',
    onboarding_completed_at: '2026-10-20T00:00:00Z',
    weight_reminder: false,
    goal_type: null,
    experience: null,
    job_activity: null,
    training_days: null,
    privacy_notice_version: '2026-10-16',
    privacy_notice_accepted_at: '2026-10-16T12:00:00Z',
    email_verified_at: '2026-10-16T12:00:00Z',
    last_active_at: '2026-10-16T12:00:00Z',
    created_at: '2026-10-16T12:00:00Z',
    updated_at: '2026-10-16T12:00:00Z',
    ...overrides,
  }
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function typeHeight(value: string) {
  const height = await screen.findByLabelText(es.profile.labels.height)
  await userEvent.clear(height)
  await userEvent.type(height, value)
}

beforeEach(() => {
  localStorage.clear()
  mockedFetch.mockReset().mockResolvedValue(profile())
  // El servidor real devuelve una marca de actualización nueva: la pantalla se vuelve a montar.
  mockedUpdate
    .mockReset()
    .mockImplementation(async (values) =>
      profile({ ...values, updated_at: new Date().toISOString() }),
    )
  vi.mocked(detectDeviceTimezone).mockReturnValue(BA)
})

describe('borradores del perfil', () => {
  it('FR-021: lo escrito sobrevive a una recarga y se avisa que se recuperó', async () => {
    const first = mount()
    await typeHeight('188')
    first.unmount() // equivale a recargar la pestaña

    mount()
    expect(await screen.findByText(es.profile.draftRestored)).toBeVisible()
    expect(screen.getByLabelText(es.profile.labels.height)).toHaveValue('188')
  })

  it('FR-021: se puede descartar el borrador y vuelve lo guardado', async () => {
    const first = mount()
    await typeHeight('188')
    first.unmount()

    mount()
    await userEvent.click(await screen.findByRole('button', { name: es.profile.draftDiscard }))
    expect(screen.getByLabelText(es.profile.labels.height)).toHaveValue('171,5')
    expect(screen.queryByText(es.profile.draftRestored)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('FR-021: tras un guardado confirmado por el servidor el borrador se elimina', async () => {
    const first = mount()
    await typeHeight('188')
    expect(localStorage.getItem(KEY)).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: es.profile.save }))
    expect(await screen.findByText(es.profile.saved)).toBeVisible()
    expect(localStorage.getItem(KEY)).toBeNull()
    first.unmount()

    mount()
    await screen.findByLabelText(es.profile.labels.height)
    expect(screen.queryByText(es.profile.draftRestored)).toBeNull()
  })

  it('FR-020 / FR-021: si el guardado falla por la red el borrador se conserva', async () => {
    mockedUpdate.mockRejectedValue(new TypeError('Failed to fetch'))
    const first = mount()
    await typeHeight('188')
    await userEvent.click(screen.getByRole('button', { name: es.profile.save }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(localStorage.getItem(KEY)).not.toBeNull()
    first.unmount()

    mount()
    expect(await screen.findByText(es.profile.draftRestored)).toBeVisible()
    expect(screen.getByLabelText(es.profile.labels.height)).toHaveValue('188')
  })

  it('si lo escrito vuelve a ser igual a lo guardado, no queda un borrador obsoleto', async () => {
    mount()
    await typeHeight('188')
    expect(localStorage.getItem(KEY)).not.toBeNull()
    await typeHeight('171,5')
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull())
  })

  it('un borrador de otra cuenta no se muestra', async () => {
    localStorage.setItem(
      'draft:v1:u2:profile',
      JSON.stringify({
        savedAt: 1,
        values: { birthDate: '', sex: '', heightCm: '199', timezone: '' },
      }),
    )
    mount()
    expect(await screen.findByLabelText(es.profile.labels.height)).toHaveValue('171,5')
    expect(screen.queryByText(es.profile.draftRestored)).toBeNull()
  })

  it('Principio I: las contraseñas escritas en el cambio de contraseña nunca se guardan', async () => {
    mount()
    await userEvent.type(
      await screen.findByLabelText(es.auth.labels.currentPassword),
      'clave-actual-larga',
    )
    await userEvent.type(screen.getByLabelText(es.auth.labels.newPassword), 'una-clave-muy-larga')
    const stored = Object.keys(localStorage).filter((k) => k.startsWith('draft:'))
    for (const key of stored) {
      expect(localStorage.getItem(key)).not.toMatch(/clave-actual-larga|una-clave-muy-larga/)
    }
  })
})
