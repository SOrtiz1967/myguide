// T022 (spec 006, FR-007, FR-009, FR-011; escenarios 6 y 8): inicio de entrenamiento — «Hoy», continuar y registrar otra fecha.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  fetchInProgressSession,
  fetchRecentSessions,
  SessionInProgressError,
  startWorkout,
  type SessionSummary,
} from '../../src/features/training/api'
import { TrainingHomePage } from '../../src/features/training/TrainingHomePage'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchInProgressSession: vi.fn(),
  fetchRecentSessions: vi.fn(),
  fetchRoutines: vi.fn().mockResolvedValue([]),
  startWorkout: vi.fn(),
}))

const mockedOpen = vi.mocked(fetchInProgressSession)
const mockedRecent = vi.mocked(fetchRecentSessions)
const mockedStart = vi.mocked(startWorkout)
const h = es.training.home

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 's1',
    session_date: '2026-10-20',
    original_date: '2026-10-20',
    status: 'completed',
    routine_name: null,
    has_plan: false,
    modified: false,
    rescheduled_count: 0,
    corrected_at: null,
    ...over,
  }
}

/** Hoy en la zona del dispositivo, como lo calcula la pantalla. */
const today = () => new Intl.DateTimeFormat('en-CA').format(new Date())
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Intl.DateTimeFormat('en-CA').format(d)
}
const daysAhead = (n: number) => daysAgo(-n)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/entrenamiento']}>
        <Routes>
          <Route path="/entrenamiento" element={<TrainingHomePage />} />
          <Route path="/entrenamiento/sesion/:id" element={<h1>Sesión abierta</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedOpen.mockReset().mockResolvedValue(null)
  mockedRecent.mockReset().mockResolvedValue([])
  mockedStart.mockReset().mockResolvedValue({
    id: 'nueva',
    session_date: today(),
    status: 'in_progress',
    revision: 1,
  })
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})
afterEach(() => vi.restoreAllMocks())

describe('«Hoy»', () => {
  it('sin nada en curso ofrece empezar una sesión vacía', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: h.startEmpty })).toBeVisible()
    expect(screen.getByText(h.recentEmpty)).toBeVisible()
  })

  it('empezar crea la sesión de hoy y la abre', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: h.startEmpty }))
    expect(await screen.findByRole('heading', { name: 'Sesión abierta' })).toBeVisible()
    expect(mockedStart).toHaveBeenCalledTimes(1)
    const [date, requestId] = mockedStart.mock.calls[0]!
    expect(date).toBeNull()
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('el doble clic crea una sola sesión (FR-047)', async () => {
    let resolve: (value: Awaited<ReturnType<typeof startWorkout>>) => void = () => {}
    mockedStart.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderPage()
    await userEvent.dblClick(await screen.findByRole('button', { name: h.startEmpty }))
    expect(mockedStart).toHaveBeenCalledTimes(1)
    resolve({ id: 'nueva', session_date: today(), status: 'in_progress', revision: 1 })
    expect(await screen.findByRole('heading', { name: 'Sesión abierta' })).toBeVisible()
  })

  it('con una sesión en curso la ofrece continuar y no deja empezar otra (escenario 8)', async () => {
    mockedOpen.mockResolvedValue(summary({ id: 'abierta', status: 'in_progress' }))
    renderPage()
    expect(await screen.findByText(h.inProgressTitle)).toBeVisible()
    expect(screen.getByRole('link', { name: h.continue })).toHaveAttribute(
      'href',
      '/entrenamiento/sesion/abierta',
    )
    expect(screen.queryByRole('button', { name: h.startEmpty })).toBeNull()
  })

  it('si el servidor dice que ya hay una abierta, ofrece continuarla', async () => {
    mockedStart.mockRejectedValue(new SessionInProgressError('otra-abierta'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: h.startEmpty }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.training.errors.sessionInProgress)
    expect(screen.getByRole('link', { name: h.continue })).toHaveAttribute(
      'href',
      '/entrenamiento/sesion/otra-abierta',
    )
  })

  it('si falla, avisa que no se creó nada y reintenta con el mismo identificador', async () => {
    mockedStart
      .mockRejectedValueOnce(new WriteError(false, 'No pudimos'))
      .mockResolvedValue({ id: 'nueva', session_date: today(), status: 'in_progress', revision: 1 })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: h.startEmpty }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos')
    await userEvent.click(screen.getByRole('button', { name: h.startEmpty }))
    expect(await screen.findByRole('heading', { name: 'Sesión abierta' })).toBeVisible()
    expect(mockedStart.mock.calls[0]![1]).toBe(mockedStart.mock.calls[1]![1])
  })
})

describe('registrar un entrenamiento de otra fecha (escenario 6)', () => {
  const field = () => screen.getByLabelText(h.otherDateLabel)

  it('acepta un día pasado', async () => {
    renderPage()
    await screen.findByRole('button', { name: h.startEmpty })
    const yesterday = daysAgo(1)
    await userEvent.type(field(), yesterday)
    await userEvent.click(screen.getByRole('button', { name: h.register }))
    expect(await screen.findByRole('heading', { name: 'Sesión abierta' })).toBeVisible()
    expect(mockedStart.mock.calls[0]![0]).toBe(yesterday)
  })

  it('el campo no deja elegir un día futuro y la pantalla lo rechaza si se escribe', async () => {
    renderPage()
    await screen.findByRole('button', { name: h.startEmpty })
    expect(field()).toHaveAttribute('max', today())
    await userEvent.type(field(), daysAhead(2))
    await userEvent.click(screen.getByRole('button', { name: h.register }))
    expect(await screen.findByText(h.futureDate)).toBeVisible()
    expect(mockedStart).not.toHaveBeenCalled()
  })

  it('sin fecha pide elegir una', async () => {
    renderPage()
    await screen.findByRole('button', { name: h.startEmpty })
    await userEvent.click(screen.getByRole('button', { name: h.register }))
    expect(await screen.findByText(h.invalidDate)).toBeVisible()
    expect(mockedStart).not.toHaveBeenCalled()
  })
})

describe('últimas sesiones', () => {
  it('lista fecha, estado y marcas, con un enlace a cada una', async () => {
    mockedRecent.mockResolvedValue([
      summary({ id: 'a', session_date: '2026-10-20', modified: true, has_plan: true }),
      summary({
        id: 'b',
        session_date: '2026-10-18',
        rescheduled_count: 1,
        corrected_at: '2026-10-19T10:00:00Z',
      }),
    ])
    renderPage()
    const first = await screen.findByRole('link', { name: /20\/10\/2026/ })
    expect(first).toHaveAttribute('href', '/entrenamiento/sesion/a')
    expect(first).toHaveTextContent(es.training.status.completed)
    expect(first).toHaveTextContent(es.training.marks.modified)
    const second = screen.getByRole('link', { name: /18\/10\/2026/ })
    expect(second).toHaveTextContent(es.training.marks.rescheduled)
    expect(second).toHaveTextContent(es.training.marks.corrected)
  })

  it('muestra la carga', () => {
    mockedOpen.mockReturnValue(new Promise(() => {}))
    mockedRecent.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('si falla, avisa y permite reintentar', async () => {
    mockedRecent.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([summary()])
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(h.recentError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('link', { name: /20\/10\/2026/ })).toBeVisible()
  })
})
