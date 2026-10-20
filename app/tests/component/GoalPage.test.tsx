// T019 (spec 004, FR-001, FR-003 a FR-006, FR-025, FR-026): fijar el objetivo de energía diaria.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { fetchGoalHistory, saveGoal } from '../../src/features/goals/api'
import type { GoalChange } from '../../src/features/goals/goalHistory'
import { GoalPage } from '../../src/features/goals/GoalPage'
import { draftKey } from '../../src/lib/drafts'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/goals/api', () => ({ fetchGoalHistory: vi.fn(), saveGoal: vi.fn() }))
vi.mock('../../src/features/meals/useToday', () => ({ useToday: () => '2026-10-19' }))

const mockedHistory = vi.mocked(fetchGoalHistory)
const mockedSave = vi.mocked(saveGoal)
const g = es.goal

const signedIn: AuthState = {
  status: 'signedIn',
  session: { user: { id: 'u1' } } as AuthState['session'],
  expired: false,
  signOut: vi.fn(),
}

const change = (effective_from: string, kcal: number | null, created_at: string): GoalChange => ({
  effective_from,
  kcal,
  created_at,
})

function Landing({ name }: { name: string }) {
  const location = useLocation()
  const added = (location.state as { added?: string } | null)?.added
  return (
    <div>
      <h1>
        {name} {location.pathname}
      </h1>
      {added ? <p role="status">{added}</p> : null}
    </div>
  )
}

function renderPage(entry = '/objetivo') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/objetivo" element={<GoalPage />} />
            <Route path="/comidas" element={<Landing name="Hoy" />} />
            <Route path="/comidas/:fecha" element={<Landing name="Día" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

const field = () => screen.getByLabelText(g.page.fieldLabel, { exact: false })
const save = () => screen.getByRole('button', { name: g.page.save })

async function typeAndSave(text: string) {
  if (text !== '') await userEvent.type(field(), text)
  await userEvent.click(save())
}

beforeEach(() => {
  mockedHistory.mockReset().mockResolvedValue([])
  mockedSave.mockReset().mockResolvedValue({ effective_from: '2026-10-19', kcal: 2000 })
})

describe('GoalPage: estados', () => {
  it('mientras carga muestra "Cargando el objetivo…"', () => {
    mockedHistory.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(g.page.loading)).toBeVisible()
  })

  it('sin objetivo dice que todavía no hay uno', async () => {
    renderPage()
    expect(await screen.findByText(g.page.none)).toBeVisible()
    expect(screen.getByRole('heading', { name: g.page.title })).toBeVisible()
    expect(screen.getByText(g.page.explanation)).toBeVisible()
    expect(screen.getByText(g.page.rule)).toBeVisible()
  })

  it('con objetivo muestra el valor vigente y desde cuándo rige', async () => {
    mockedHistory.mockResolvedValue([change('2026-10-01', 2000, '2026-10-01T09:00:00Z')])
    renderPage()
    expect(await screen.findByText(g.page.current(2000, '1 de octubre'))).toBeVisible()
    expect(screen.queryByText(g.page.none)).not.toBeInTheDocument()
  })

  it('si no se puede cargar el historial lo dice y permite reintentar', async () => {
    mockedHistory.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText(g.loadError)).toBeVisible()
    mockedHistory.mockResolvedValue([])
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByText(g.page.none)).toBeVisible()
  })

  it('el campo tiene su etiqueta y la ayuda con el rango', async () => {
    renderPage()
    await screen.findByText(g.page.none)
    expect(field()).toHaveAccessibleDescription(g.page.fieldHelp)
  })
})

describe('GoalPage: validación (FR-003, FR-004)', () => {
  it.each([
    ['', g.validation.empty],
    ['abc', g.validation.notNumber],
    ['1800,5', g.validation.notInteger],
    ['999', g.validation.range],
    ['6001', g.validation.range],
  ])('«%s» muestra su mensaje y no guarda nada', async (text, message) => {
    renderPage()
    await screen.findByText(g.page.none)
    await typeAndSave(text)
    expect(await screen.findByText(message)).toBeVisible()
    expect(field()).toBeInvalid()
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it.each([
    ['2.000', 2000],
    ['2000,0', 2000],
    ['1800', 1800],
  ])('«%s» se guarda como %i kcal', async (text, kcal) => {
    renderPage()
    await screen.findByText(g.page.none)
    await typeAndSave(text)
    await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1))
    expect(mockedSave.mock.calls[0]![0]).toBe(kcal)
    expect(mockedSave.mock.calls[0]![1]).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('GoalPage: guardar (FR-006, FR-025)', () => {
  it('al guardar vuelve al día indicado con la confirmación y vuelve a pedir el historial', async () => {
    renderPage('/objetivo?volver=2026-10-18')
    await screen.findByText(g.page.none)
    await typeAndSave('2000')
    expect(await screen.findByRole('heading', { name: 'Día /comidas/2026-10-18' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(g.page.saved)
    expect(mockedHistory.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('sin día de vuelta, o con uno inválido, vuelve al día de hoy', async () => {
    const first = renderPage()
    await screen.findByText(g.page.none)
    await typeAndSave('2000')
    expect(await screen.findByRole('heading', { name: 'Día /comidas/2026-10-19' })).toBeVisible()
    first.unmount()

    renderPage('/objetivo?volver=cualquier-cosa')
    await screen.findByText(g.page.none)
    await typeAndSave('2000')
    expect(await screen.findByRole('heading', { name: 'Día /comidas/2026-10-19' })).toBeVisible()
  })

  it('un doble clic envía una sola solicitud', async () => {
    mockedSave.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ effective_from: '2026-10-19', kcal: 2000 }), 30),
        ),
    )
    renderPage()
    await screen.findByText(g.page.none)
    await userEvent.type(field(), '2000')
    await userEvent.dblClick(save())
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Día /comidas/2026-10-19' })).toBeVisible(),
    )
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })

  it('si no llegó al servidor lo dice, conserva lo escrito y el reintento usa la misma solicitud', async () => {
    mockedSave.mockRejectedValueOnce(new WriteError(true, es.errors.offline))
    renderPage()
    await screen.findByText(g.page.none)
    await typeAndSave('2000')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(es.errors.offline)
    expect(alert).toHaveTextContent(g.page.notSaved)
    expect(
      screen.queryByRole('heading', { name: 'Día /comidas/2026-10-19' }),
    ).not.toBeInTheDocument()
    expect(field()).toHaveValue('2000')

    await userEvent.click(save())
    await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2))
    expect(mockedSave.mock.calls[1]![1]).toBe(mockedSave.mock.calls[0]![1])
    expect(await screen.findByRole('heading', { name: 'Día /comidas/2026-10-19' })).toBeVisible()
  })

  it('con la sesión vencida avisa y conserva el borrador', async () => {
    mockedSave.mockRejectedValueOnce(new WriteError(false, es.auth.sessionExpired))
    renderPage()
    await screen.findByText(g.page.none)
    await typeAndSave('1900')
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.sessionExpired)
    await waitFor(() => expect(localStorage.getItem(draftKey('u1', 'energy-goal'))).not.toBeNull())
    expect(field()).toHaveValue('1900')
  })
})

describe('GoalPage: borrador (FR-025)', () => {
  it('lo escrito vuelve al reabrir la pantalla, con un aviso', async () => {
    const first = renderPage()
    await screen.findByText(g.page.none)
    await userEvent.type(field(), '1850')
    await waitFor(() => expect(localStorage.getItem(draftKey('u1', 'energy-goal'))).not.toBeNull())
    first.unmount()

    renderPage()
    await screen.findByText(g.page.none)
    expect(field()).toHaveValue('1850')
    expect(screen.getByText(g.page.draftRestored)).toBeVisible()
  })

  it('se borra al guardar', async () => {
    renderPage()
    await screen.findByText(g.page.none)
    await typeAndSave('2000')
    await screen.findByRole('heading', { name: 'Día /comidas/2026-10-19' })
    expect(localStorage.getItem(draftKey('u1', 'energy-goal'))).toBeNull()
  })

  it('«Descartar» limpia el campo y el borrador', async () => {
    localStorage.setItem(
      draftKey('u1', 'energy-goal'),
      JSON.stringify({ savedAt: Date.now(), values: { kcal: '1700' } }),
    )
    renderPage()
    await screen.findByText(g.page.none)
    expect(field()).toHaveValue('1700')
    await userEvent.click(screen.getByRole('button', { name: g.page.draftDiscard }))
    expect(field()).toHaveValue('')
    expect(localStorage.getItem(draftKey('u1', 'energy-goal'))).toBeNull()
  })
})

describe('GoalPage: nota informativa (FR-005)', () => {
  it('con un objetivo vigente menor a 1.200 kcal se muestra la nota', async () => {
    mockedHistory.mockResolvedValue([change('2026-10-01', 1100, '2026-10-01T09:00:00Z')])
    renderPage()
    expect(await screen.findByText(g.lowGoalNote)).toBeVisible()
  })

  it('con 1.200 kcal o más no aparece, y sin objetivo tampoco', async () => {
    mockedHistory.mockResolvedValue([change('2026-10-01', 1200, '2026-10-01T09:00:00Z')])
    const first = renderPage()
    await screen.findByText(g.page.current(1200, '1 de octubre'))
    expect(screen.queryByText(g.lowGoalNote)).not.toBeInTheDocument()
    first.unmount()

    mockedHistory.mockResolvedValue([])
    renderPage()
    await screen.findByText(g.page.none)
    expect(screen.queryByText(g.lowGoalNote)).not.toBeInTheDocument()
  })
})
