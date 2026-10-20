// T020 (spec 004, FR-002, SC-009): la tarjeta "Objetivo del día", variante sin objetivo.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchGoalHistory } from '../../src/features/goals/api'
import type { GoalChange } from '../../src/features/goals/goalHistory'
import { GoalSummary } from '../../src/features/goals/GoalSummary'
import type { SummaryEntry } from '../../src/features/goals/daySummary'

vi.mock('../../src/features/goals/api', () => ({ fetchGoalHistory: vi.fn(), saveGoal: vi.fn() }))
const mockedHistory = vi.mocked(fetchGoalHistory)
const g = es.goal

const item = (
  energy_kcal: number | null,
  status: 'confirmed' | 'pending' = 'confirmed',
): SummaryEntry => ({
  energy_kcal,
  status,
})
const change = (effective_from: string, kcal: number | null, created_at: string): GoalChange => ({
  effective_from,
  kcal,
  created_at,
})

function renderCard(props: { date?: string; today?: string; entries?: SummaryEntry[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GoalSummary
          date={props.date ?? '2026-10-19'}
          today={props.today ?? '2026-10-19'}
          entries={props.entries ?? [item(1000), item(350)]}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedHistory.mockReset().mockResolvedValue([])
})

/** Nada del objetivo: ni restantes, ni porcentaje, ni barra, ni vacíos ni en cero (FR-002, SC-009). */
function expectNoGoalElements(container: HTMLElement) {
  expect(screen.queryByText(/restan/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  expect(screen.queryByText(/objetivo:/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(container.querySelector('[data-goal-bar]')).toBeNull()
  expect(screen.queryByText(g.change)).not.toBeInTheDocument()
  expect(screen.queryByText(g.howTitle)).not.toBeInTheDocument()
}

describe('GoalSummary sin objetivo', () => {
  it('muestra solo lo registrado, con la invitación opcional a fijar un objetivo hoy', async () => {
    const { container } = renderCard()
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    const section = screen.getByRole('region', { name: g.cardTitle })
    expect(section).toBeVisible()
    const invite = screen.getByRole('link', { name: g.invite })
    expect(invite).toHaveAttribute('href', '/objetivo?volver=2026-10-19')
    expectNoGoalElements(container)
  })

  it('una fecha futura también invita', async () => {
    renderCard({ date: '2026-10-22' })
    expect(await screen.findByRole('link', { name: g.invite })).toHaveAttribute(
      'href',
      '/objetivo?volver=2026-10-22',
    )
  })

  it('un día pasado muestra solo lo registrado, sin invitación', async () => {
    const { container } = renderCard({ date: '2026-10-18' })
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expectNoGoalElements(container)
  })

  it('un objetivo que empieza después de ese día no cuenta: sigue sin objetivo', async () => {
    mockedHistory.mockResolvedValue([change('2026-10-19', 2000, '2026-10-19T09:00:00Z')])
    const { container } = renderCard({ date: '2026-10-18' })
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    expectNoGoalElements(container)
  })

  it('un día quitado el objetivo no muestra nada del objetivo', async () => {
    mockedHistory.mockResolvedValue([
      change('2026-10-01', 2000, '2026-10-01T09:00:00Z'),
      change('2026-10-15', null, '2026-10-15T09:00:00Z'),
    ])
    const { container } = renderCard()
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    expectNoGoalElements(container)
  })

  it('mientras carga el historial no muestra la invitación ni lo registrado como si no hubiera objetivo', () => {
    mockedHistory.mockReturnValue(new Promise(() => {}))
    renderCard()
    expect(screen.getByText(g.page.loading)).toBeVisible()
    expect(screen.queryByRole('link', { name: g.invite })).not.toBeInTheDocument()
    expect(screen.queryByText(g.registered(1350, false))).not.toBeInTheDocument()
  })

  it('si falla el historial lo dice y permite reintentar, sin mostrar cifras del objetivo', async () => {
    mockedHistory.mockRejectedValueOnce(new Error('boom'))
    renderCard()
    expect(await screen.findByText(g.loadError)).toBeVisible()
    expect(screen.getByRole('button', { name: es.common.retry })).toBeVisible()
    expect(screen.queryByText(/restan/i)).not.toBeInTheDocument()
  })
})
