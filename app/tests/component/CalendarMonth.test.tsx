// T054 (spec 006, escenario 36): el calendario del mes — enlaces por día, estados con texto, navegación y estados de carga.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSessionsBetween, type SessionSummary } from '../../src/features/training/api'
import { CalendarMonth } from '../../src/features/training/CalendarMonth'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchSessionsBetween: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchSessionsBetween)

function summary(over: Partial<SessionSummary>): SessionSummary {
  return {
    id: 's',
    session_date: '2026-10-22',
    original_date: '2026-10-22',
    status: 'completed',
    routine_name: null,
    has_plan: false,
    modified: false,
    rescheduled_count: 0,
    corrected_at: null,
    ...over,
  }
}

function renderCalendar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CalendarMonth />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('CalendarMonth', () => {
  it('cada día es un enlace con nombre completo y el estado dicho con palabras', async () => {
    mockedFetch.mockResolvedValue([
      summary({ id: 'a', status: 'completed' }),
      summary({ id: 'b', status: 'planned' }),
      summary({ id: 'c', status: 'planned', session_date: '2026-10-20' }),
    ])
    renderCalendar()
    const link = await screen.findByRole('link', {
      name: 'jueves 22 de octubre: 1 sesión realizada, 1 planificada',
    })
    expect(link).toHaveAttribute('href', '/entrenamiento/dia/2026-10-22')
    expect(link).toHaveAttribute('aria-current', 'date')
    expect(
      screen.getByRole('link', { name: 'martes 20 de octubre: 1 sin registrar' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'viernes 23 de octubre: sin sesiones' }),
    ).toBeInTheDocument()
    expect(screen.getByText('octubre de 2026')).toBeInTheDocument()
  })

  it('pide la cuadrícula completa del mes y cambia de mes con los botones', async () => {
    mockedFetch.mockResolvedValue([summary({})])
    const user = userEvent.setup()
    renderCalendar()
    await screen.findByRole('link', { name: /jueves 22 de octubre/ })
    expect(mockedFetch).toHaveBeenLastCalledWith('2026-09-28', '2026-11-01')

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(await screen.findByText('noviembre de 2026')).toBeInTheDocument()
    expect(mockedFetch).toHaveBeenLastCalledWith('2026-10-26', '2026-12-06')

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(await screen.findByText('septiembre de 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(await screen.findByText('octubre de 2026')).toBeInTheDocument()
  })

  it('un mes sin sesiones lo dice con una invitación neutral', async () => {
    mockedFetch.mockResolvedValue([])
    renderCalendar()
    expect(await screen.findByText(/No hay sesiones este mes/)).toBeInTheDocument()
  })

  it('muestra la carga y, si falla, un error con «Reintentar»', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderCalendar()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByText('No pudimos cargar el calendario.')).toBeInTheDocument()
    mockedFetch.mockResolvedValue([summary({})])
    await user.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByRole('link', { name: /jueves 22 de octubre/ })).toBeInTheDocument()
  })

  it('sin conexión avisa y no presenta datos como actuales', async () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    mockedFetch.mockResolvedValue([summary({})])
    renderCalendar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.queryByRole('link', { name: /jueves 22 de octubre/ })).not.toBeInTheDocument()
    online.mockRestore()
  })
})
