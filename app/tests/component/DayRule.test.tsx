// T047 (spec 003, FR-024 a FR-027): la regla del día. El servidor decide si se propone el día que se cierra.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import {
  fetchDayEntries,
  fetchDayStatus,
  fetchRecents,
  startLogDay,
  type DayStatus,
} from '../../src/features/meals/api'
import { AddEntryPage } from '../../src/features/meals/AddEntryPage'
import { DayPage } from '../../src/features/meals/DayPage'
import { MealsRedirect } from '../../src/features/meals/MealsRedirect'
import { fetchProfile, type Profile } from '../../src/features/profile/api'

vi.mock('../../src/features/meals/api', () => ({
  fetchDayEntries: vi.fn(),
  fetchDayStatus: vi.fn(),
  fetchRecents: vi.fn(),
  fetchPhotos: vi.fn().mockResolvedValue([]),
  startLogDay: vi.fn(),
  addEntry: vi.fn(),
}))
vi.mock('../../src/features/foods/api', () => ({
  createFood: vi.fn(),
  searchFoods: vi.fn().mockResolvedValue([]),
  catalogHasFoods: vi.fn().mockResolvedValue(true),
  fetchFood: vi.fn(),
}))
vi.mock('../../src/features/profile/api', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))

const signedIn: AuthState = {
  status: 'signedIn',
  session: { access_token: 'jwt', user: { id: 'u1' } } as never,
  expired: false,
  signOut: async () => {},
}

const profile = {
  user_id: 'u1',
  birth_date: null,
  sex: null,
  height_cm: null,
  timezone: 'America/Argentina/Buenos_Aires',
  unit_system: 'metric',
  last_active_at: '2026-10-19T00:00:00Z',
} as unknown as Profile

// A la 01:00 del martes 20 hay algo registrado el lunes 19 y nada el 20.
const closing: DayStatus = { today: '2026-10-20', proposed_date: '2026-10-19', closing: true }
const normal: DayStatus = { today: '2026-10-20', proposed_date: '2026-10-20', closing: false }

function Where() {
  return <h1>Estoy en {useLocation().pathname}</h1>
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/comidas" element={<MealsRedirect />} />
            <Route path="/comidas/:fecha" element={<DayPage />} />
            <Route path="/comidas/:fecha/agregar" element={<AddEntryPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  // Solo se simula la fecha: ahora es el martes 20/10/2026 01:00 en Buenos Aires.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-20T04:00:00Z') })
  vi.mocked(fetchDayEntries).mockReset().mockResolvedValue([])
  vi.mocked(fetchRecents).mockReset().mockResolvedValue([])
  vi.mocked(fetchDayStatus).mockReset().mockResolvedValue(closing)
  vi.mocked(startLogDay).mockReset().mockResolvedValue(undefined)
  vi.mocked(fetchProfile).mockReset().mockResolvedValue(profile)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('el día que se cierra (FR-025)', () => {
  it('/comidas lleva al día propuesto', async () => {
    renderAt('/comidas')
    expect(
      await screen.findByRole('heading', { level: 1, name: /lunes 19 de octubre/i }),
    ).toBeVisible()
  })

  it('sin día que cerrar, /comidas lleva a hoy', async () => {
    vi.mocked(fetchDayStatus).mockResolvedValue(normal)
    renderAt('/comidas')
    expect(
      await screen.findByRole('heading', { level: 1, name: /martes 20 de octubre/i }),
    ).toBeVisible()
  })

  it('si el servidor no responde, /comidas lleva a hoy', async () => {
    vi.mocked(fetchDayStatus).mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/comidas')
    expect(
      await screen.findByRole('heading', { level: 1, name: /martes 20 de octubre/i }),
    ).toBeVisible()
  })

  it('muestra en qué día se registra, en una región visible, con el botón para empezar hoy', async () => {
    renderAt('/comidas/2026-10-19')
    const region = await screen.findByRole('region', {
      name: es.meals.day.closing('lunes 19 de octubre'),
    })
    expect(within(region).getByText(es.meals.day.closing('lunes 19 de octubre'))).toBeVisible()
    expect(within(region).getByRole('button', { name: es.meals.day.startToday })).toBeVisible()
  })

  it('no muestra el aviso en otros días ni cuando no hay nada que cerrar', async () => {
    renderAt('/comidas/2026-10-20')
    await screen.findByRole('heading', { level: 1, name: /martes 20 de octubre/i })
    expect(screen.queryByText(es.meals.day.startToday)).not.toBeInTheDocument()
  })

  it('"Empezar el día de hoy" marca el día y lleva a hoy', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    renderAt('/comidas/2026-10-19')
    await user.click(await screen.findByRole('button', { name: es.meals.day.startToday }))
    await waitFor(() => expect(startLogDay).toHaveBeenCalledWith('2026-10-20'))
    vi.mocked(fetchDayStatus).mockResolvedValue(normal)
    expect(
      await screen.findByRole('heading', { level: 1, name: /martes 20 de octubre/i }),
    ).toBeVisible()
  })

  it('si no se pudo empezar el día, lo dice y se puede reintentar', async () => {
    vi.mocked(startLogDay).mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup({ advanceTimers: () => {} })
    renderAt('/comidas/2026-10-19')
    await user.click(await screen.findByRole('button', { name: es.meals.day.startToday }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByRole('button', { name: es.meals.day.startToday })).toBeEnabled()
  })
})

describe('agregar mientras el día se cierra', () => {
  it('muestra la fecha de destino y permite elegir el día nuevo antes de guardar', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    renderAt('/comidas/2026-10-19/agregar?comida=dinner')
    expect(await screen.findByText(es.meals.add.destination('lunes 19 de octubre'))).toBeVisible()
    await user.click(
      await screen.findByRole('link', { name: es.meals.add.switchDay('martes 20 de octubre') }),
    )
    expect(await screen.findByText(es.meals.add.destination('martes 20 de octubre'))).toBeVisible()
    expect(
      screen.getByRole('link', { name: es.meals.add.switchDay('lunes 19 de octubre') }),
    ).toBeVisible()
  })

  it('sin día que cerrar no ofrece cambiar de día', async () => {
    vi.mocked(fetchDayStatus).mockResolvedValue(normal)
    renderAt('/comidas/2026-10-20/agregar?comida=dinner')
    expect(await screen.findByText(es.meals.add.destination('martes 20 de octubre'))).toBeVisible()
    expect(screen.queryByRole('link', { name: /Registrar en el/ })).not.toBeInTheDocument()
  })
})
