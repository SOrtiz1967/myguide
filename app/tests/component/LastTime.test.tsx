// T064 (spec 006, escenario 38): «La última vez» dentro de una sesión, en un paso y sin salir.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchExerciseHistory } from '../../src/features/training/api'
import { LastTime } from '../../src/features/training/LastTime'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchExerciseHistory: vi.fn(),
}))

const h = es.training.history
const mocked = vi.mocked(fetchExerciseHistory)

function renderLastTime() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LastTime exerciseId="e1" sessionId="actual" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.clearAllMocks())

describe('LastTime', () => {
  it('no consulta hasta que se pide y entonces muestra la vez anterior más reciente, sin la sesión actual', async () => {
    mocked.mockResolvedValue({
      total: 3,
      entries: [
        {
          session_id: 's3',
          session_date: '2026-10-15',
          exercise_name: 'Press banca',
          measurement_type: 'reps_weight',
          effort: 7,
          note: null,
          sets: [{ reps: 5, weight_kg: 70 }],
          total_estimate: 3,
        },
      ],
    })
    const user = userEvent.setup()
    renderLastTime()
    expect(mocked).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: h.lastTime }))
    expect(await screen.findByText('5 repeticiones · 70 kg')).toBeInTheDocument()
    expect(mocked).toHaveBeenCalledWith('e1', 'actual', 1, 0)
    expect(screen.getAllByText(/15\/10\/2026/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: h.view })).toHaveAttribute(
      'href',
      '/ejercicios/e1/historia',
    )

    await user.click(screen.getByRole('button', { name: h.hideLastTime }))
    expect(screen.queryByText('5 repeticiones · 70 kg')).not.toBeInTheDocument()
  })

  it('un ejercicio sin historia lo dice sin inventar datos', async () => {
    mocked.mockResolvedValue({ total: 0, entries: [] })
    const user = userEvent.setup()
    renderLastTime()
    await user.click(screen.getByRole('button', { name: h.lastTime }))
    expect(await screen.findByText(h.empty)).toBeInTheDocument()
  })

  it('si falla, avisa y permite reintentar', async () => {
    mocked.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderLastTime()
    await user.click(screen.getByRole('button', { name: h.lastTime }))
    expect(await screen.findByText(h.loadError)).toBeInTheDocument()
    mocked.mockResolvedValue({ total: 0, entries: [] })
    await user.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByText(h.empty)).toBeInTheDocument()
  })
})
