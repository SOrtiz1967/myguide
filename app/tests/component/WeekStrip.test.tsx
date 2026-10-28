// Spec 016: la semana muestra, por día, calorías frente al rango y estado del entrenamiento, sin juzgar.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchGoalHistory } from '../../src/features/goals/api'
import { fetchEntriesBetween } from '../../src/features/meals/api'
import { fetchWeightsBetween } from '../../src/features/measures/api'
import { fetchSessionsBetween, type SessionSummary } from '../../src/features/training/api'
import { WeekStrip } from '../../src/features/week/WeekStrip'

vi.mock('../../src/features/goals/api', () => ({ fetchGoalHistory: vi.fn() }))
vi.mock('../../src/features/meals/api', () => ({ fetchEntriesBetween: vi.fn() }))
vi.mock('../../src/features/measures/api', () => ({ fetchWeightsBetween: vi.fn() }))
vi.mock('../../src/features/training/api', () => ({ fetchSessionsBetween: vi.fn() }))

const w = es.week
const today = '2026-10-28' // miércoles

const entry = (log_date: string, energy_kcal: number) => ({
  log_date,
  energy_kcal,
  protein_g: null,
  status: 'confirmed' as const,
})
const session = (over: Partial<SessionSummary>): SessionSummary => ({
  id: 's',
  session_date: '2026-10-26',
  original_date: '2026-10-26',
  status: 'completed',
  routine_name: null,
  has_plan: false,
  modified: false,
  rescheduled_count: 0,
  corrected_at: null,
  ...over,
})

function renderStrip(props: Partial<Parameters<typeof WeekStrip>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSelect = vi.fn()
  const onAnchorChange = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WeekStrip
          anchor={today}
          today={today}
          selected={today}
          onSelect={onSelect}
          onAnchorChange={onAnchorChange}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onSelect, onAnchorChange }
}

beforeEach(() => {
  vi.mocked(fetchGoalHistory).mockResolvedValue([
    { effective_from: '2000-01-01', kcal: 2000, created_at: '2026-01-01T00:00:00Z' },
  ])
  vi.mocked(fetchEntriesBetween).mockResolvedValue([
    entry('2026-10-26', 1000),
    entry('2026-10-27', 2000),
    entry('2026-10-28', 900),
  ])
  vi.mocked(fetchSessionsBetween).mockResolvedValue([
    session({ id: 'a', session_date: '2026-10-26', status: 'completed' }),
    session({ id: 'b', session_date: '2026-10-30', status: 'planned' }),
  ])
  vi.mocked(fetchWeightsBetween).mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('WeekStrip', () => {
  it('muestra siete días con una etiqueta completa que dice kcal, estado y entrenamiento', async () => {
    renderStrip()
    await screen.findByRole('button', { name: /1\.000 de 2\.000 kcal/ })
    const days = screen.getAllByRole('button', { name: /Calorías:/ })
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveAccessibleName(
      'lunes 26 de octubre. Calorías: 1.000 de 2.000 kcal, por debajo del rango. Entrenamiento: hecho.',
    )
    expect(days[1]).toHaveAccessibleName(
      'martes 27 de octubre. Calorías: 2.000 de 2.000 kcal, en rango. Entrenamiento: sin sesión.',
    )
    expect(days[2]).toHaveAccessibleName(
      'miércoles 28 de octubre, hoy. Calorías: 900 de 2.000 kcal, en curso. Entrenamiento: sin sesión.',
    )
    expect(days[3]).toHaveAccessibleName(
      'jueves 29 de octubre. Calorías: aún no llegó. Entrenamiento: sin sesión.',
    )
    expect(days[4]).toHaveAccessibleName(/viernes 30 de octubre.*Entrenamiento: planificado\./)
  })

  it('un día sin ítems es «sin registro» y no «por debajo»', async () => {
    vi.mocked(fetchEntriesBetween).mockResolvedValue([])
    renderStrip({ anchor: '2026-10-21', selected: '2026-10-21' })
    const days = await screen.findAllByRole('button', { name: /Calorías: sin registro/ })
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveAccessibleName(/Calorías: sin registro\./)
  })

  it('sin objetivo muestra solo lo registrado', async () => {
    vi.mocked(fetchGoalHistory).mockResolvedValue([])
    renderStrip()
    await screen.findByRole('button', { name: /1\.000 kcal, sin objetivo/ })
  })

  it('marca el día elegido, elige otro y cambia de semana', async () => {
    const user = userEvent.setup()
    const { onSelect, onAnchorChange } = renderStrip()
    const days = await screen.findAllByRole('button', { name: /Calorías:/ })
    expect(days[2]).toHaveAttribute('aria-pressed', 'true')
    expect(days[0]).toHaveAttribute('aria-pressed', 'false')
    await user.click(days[0]!)
    expect(onSelect).toHaveBeenCalledWith('2026-10-26')
    await user.click(screen.getByRole('button', { name: w.prev }))
    expect(onAnchorChange).toHaveBeenCalledWith('2026-10-21')
    await user.click(screen.getByRole('button', { name: w.next }))
    expect(onAnchorChange).toHaveBeenCalledWith('2026-11-04')
    expect(screen.queryByRole('button', { name: w.current })).not.toBeInTheDocument()
  })

  it('en otra semana ofrece volver a la actual', async () => {
    const user = userEvent.setup()
    const { onAnchorChange } = renderStrip({ anchor: '2026-10-21', selected: '2026-10-21' })
    await user.click(await screen.findByRole('button', { name: w.current }))
    expect(onAnchorChange).toHaveBeenCalledWith(today)
  })

  it('si fallan las comidas lo dice con «Reintentar» y el entrenamiento sigue', async () => {
    vi.mocked(fetchEntriesBetween).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderStrip()
    expect(await screen.findByText(w.loadErrorCalories)).toBeInTheDocument()
    await screen.findByRole('button', { name: /Entrenamiento: hecho/ })
    vi.mocked(fetchEntriesBetween).mockResolvedValue([entry('2026-10-26', 1000)])
    await user.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByRole('button', { name: /1\.000 de 2\.000 kcal/ })).toBeInTheDocument()
  })
})
