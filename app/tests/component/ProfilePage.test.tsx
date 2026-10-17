// T053 (FR-013 a FR-017, FR-023, FR-031): pantalla de perfil.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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
const mockedDevice = vi.mocked(detectDeviceTimezone)

const BA = 'America/Argentina/Buenos_Aires'

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 'u1',
    birth_date: '1990-05-17',
    sex: 'female',
    height_cm: 171.5,
    timezone: BA,
    unit_system: 'metric',
    privacy_notice_version: '2026-10-16',
    privacy_notice_accepted_at: '2026-10-16T12:00:00Z',
    email_verified_at: '2026-10-16T12:00:00Z',
    last_active_at: '2026-10-16T12:00:00Z',
    created_at: '2026-10-16T12:00:00Z',
    updated_at: '2026-10-16T12:00:00Z',
    ...overrides,
  }
}

const EMPTY = profile({ birth_date: null, sex: null, height_cm: null, timezone: null })

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(profile())
  // El servidor real devuelve una marca de actualización nueva: la pantalla se vuelve a montar.
  mockedUpdate
    .mockReset()
    .mockImplementation(async (values) =>
      profile({ ...values, updated_at: new Date().toISOString() }),
    )
  mockedDevice.mockReset().mockReturnValue(BA)
})

describe('ProfilePage: estados', () => {
  it('FR-023: muestra el estado de carga', async () => {
    mockedFetch.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(await screen.findByRole('status')).toHaveTextContent(es.profile.loading)
  })

  it('FR-023: muestra el error de carga y permite reintentar', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(profile())
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.profile.loadError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByText('17/05/1990')).toBeVisible()
  })
})

describe('ProfilePage: datos mostrados', () => {
  it('FR-015 / FR-031: muestra la altura con su unidad y la fecha día/mes/año', async () => {
    renderPage()
    const summary = await screen.findByRole('region', { name: es.profile.summaryTitle })
    expect(within(summary).getByText('171,5 cm')).toBeVisible()
    expect(within(summary).getByText('17/05/1990')).toBeVisible()
    expect(within(summary).getByText(es.profile.sexOptions.female)).toBeVisible()
    expect(within(summary).getByText(BA)).toBeVisible()
  })

  it('FR-017: los datos sin informar se muestran como "No informado", nunca con un valor supuesto', async () => {
    mockedFetch.mockResolvedValue(EMPTY)
    renderPage()
    const summary = await screen.findByRole('region', { name: es.profile.summaryTitle })
    expect(within(summary).getAllByText(es.profile.notInformed)).toHaveLength(4)
    expect(within(summary).queryByText(/0 cm/)).toBeNull()
  })
})

describe('ProfilePage: formulario', () => {
  it('FR-013 / FR-015: la altura indica su unidad y el sexo ofrece "Prefiero no indicarlo"', async () => {
    renderPage()
    expect(await screen.findByLabelText(es.profile.labels.height)).toBeVisible()
    const sex = screen.getByLabelText(es.profile.labels.sex)
    expect(
      within(sex)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      es.profile.sexOptions.unspecified,
      es.profile.sexOptions.female,
      es.profile.sexOptions.male,
    ])
  })

  it('FR-013: guarda los cambios y confirma el éxito', async () => {
    renderPage()
    const height = await screen.findByLabelText(es.profile.labels.height)
    await userEvent.clear(height)
    await userEvent.type(height, '172')
    await userEvent.click(screen.getByRole('button', { name: es.profile.save }))
    expect(await screen.findByText(es.profile.saved)).toBeVisible()
    expect(mockedUpdate).toHaveBeenCalledWith({
      birth_date: '1990-05-17',
      sex: 'female',
      height_cm: 172,
      timezone: BA,
    })
  })

  it('FR-017: "Prefiero no indicarlo" guarda el sexo como no informado', async () => {
    renderPage()
    await userEvent.selectOptions(
      await screen.findByLabelText(es.profile.labels.sex),
      es.profile.sexOptions.unspecified,
    )
    await userEvent.click(screen.getByRole('button', { name: es.profile.save }))
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedUpdate.mock.calls[0]?.[0].sex).toBeNull()
  })

  it('FR-014: una altura fuera de rango muestra un error comprensible y no guarda', async () => {
    renderPage()
    const height = await screen.findByLabelText(es.profile.labels.height)
    await userEvent.clear(height)
    await userEvent.type(height, '30')
    await userEvent.click(screen.getByRole('button', { name: es.profile.save }))
    expect(await screen.findByText(es.profile.errors.height)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('FR-020: si falla la red avisa que no se guardó y conserva lo escrito', async () => {
    mockedUpdate.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    const height = await screen.findByLabelText(es.profile.labels.height)
    await userEvent.clear(height)
    await userEvent.type(height, '180')
    await userEvent.click(screen.getByRole('button', { name: es.profile.save }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.queryByText(es.profile.saved)).toBeNull()
    expect(screen.getByLabelText(es.profile.labels.height)).toHaveValue('180')
  })
})

describe('ProfilePage: zona horaria (FR-016)', () => {
  it('si la del dispositivo difiere de la guardada, la ofrece pero NO la aplica sola', async () => {
    mockedFetch.mockResolvedValue(profile({ timezone: 'Europe/Madrid' }))
    renderPage()
    const notice = await screen.findByRole('region', { name: es.profile.timezoneNoticeTitle })
    expect(notice).toHaveTextContent(es.profile.deviceTimezoneIs(BA))
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('al aceptar, cambia solo la zona horaria y deja el resto igual', async () => {
    mockedFetch.mockResolvedValue(profile({ timezone: 'Europe/Madrid' }))
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: es.profile.useDeviceTimezone(BA) }),
    )
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedUpdate).toHaveBeenCalledWith({
      birth_date: '1990-05-17',
      sex: 'female',
      height_cm: 171.5,
      timezone: BA,
    })
  })

  it('si coincide con la guardada, no muestra ningún aviso', async () => {
    renderPage()
    await screen.findByText('17/05/1990')
    expect(screen.queryByRole('region', { name: es.profile.timezoneNoticeTitle })).toBeNull()
  })

  it('sin zona guardada la propone pero deja el selector sin elegir', async () => {
    mockedFetch.mockResolvedValue(EMPTY)
    renderPage()
    expect(
      await screen.findByRole('region', { name: es.profile.timezoneNoticeTitle }),
    ).toBeVisible()
    expect(screen.getByLabelText(es.profile.labels.timezone)).toHaveValue('')
    expect(mockedUpdate).not.toHaveBeenCalled()
  })
})

describe('ProfilePage: cuenta', () => {
  it('incluye el cambio de contraseña', async () => {
    renderPage()
    expect(await screen.findByLabelText(es.auth.labels.currentPassword)).toBeVisible()
  })
})
