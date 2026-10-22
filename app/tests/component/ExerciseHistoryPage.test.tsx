// T063 (spec 006, escenarios 37 y 39): la historia de un ejercicio, por tandas, sin valoraciones.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchExerciseHistory, type HistoryEntry } from '../../src/features/training/api'
import { ExerciseHistoryPage } from '../../src/features/training/ExerciseHistoryPage'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchExerciseHistory: vi.fn(),
}))
vi.mock('../../src/features/exercises/useExercise', () => ({
  useExercise: () => ({ data: { id: 'e1', name: 'Press banca' } }),
}))

const h = es.training.history
const mocked = vi.mocked(fetchExerciseHistory)

function entry(over: Partial<HistoryEntry>): HistoryEntry {
  return {
    session_id: 's1',
    session_date: '2026-10-15',
    exercise_name: 'Press banca',
    measurement_type: 'reps_weight',
    effort: 7,
    note: null,
    sets: [{ reps: 8, weight_kg: 60 }],
    total_estimate: 1,
    ...over,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/ejercicios/e1/historia']}>
        <Routes>
          <Route path="/ejercicios/:id/historia" element={<ExerciseHistoryPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.clearAllMocks())

describe('ExerciseHistoryPage', () => {
  it('lista las veces con fecha, nombre guardado, series con unidades, esfuerzo y enlace a la sesión', async () => {
    mocked.mockResolvedValue({
      total: 2,
      entries: [
        entry({ total_estimate: 2 }),
        entry({
          session_id: 's2',
          session_date: '2026-10-08',
          exercise_name: 'Press plano',
          effort: null,
          sets: [{ reps: 6 }],
          total_estimate: 2,
        }),
      ],
    })
    renderPage()
    const items = (await screen.findAllByRole('listitem')).filter((li) => li.matches('ul > li'))
    const first = items[0]!
    expect(within(first).getByText(/15\/10\/2026 · Press banca/)).toBeInTheDocument()
    expect(within(first).getByText('8 repeticiones · 60 kg')).toBeInTheDocument()
    expect(within(first).getByText(`${es.training.session.effort}: 7 de 10`)).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: /Ver la sesión/ })).toHaveAttribute(
      'href',
      '/entrenamiento/sesion/s1',
    )
    const second = items[1]!
    expect(within(second).getByText(/Press plano/)).toBeInTheDocument()
    expect(within(second).getByText('6 repeticiones · peso: sin dato')).toBeInTheDocument()
    expect(
      within(second).getByText(`${es.training.session.effort}: ${es.training.noData}`),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: h.loadMore })).not.toBeInTheDocument()
  })

  it('pide más con «Ver más» hasta completar', async () => {
    mocked.mockResolvedValueOnce({
      total: 2,
      entries: [entry({ total_estimate: 2 })],
    })
    mocked.mockResolvedValueOnce({
      total: 2,
      entries: [entry({ session_id: 's2', session_date: '2026-10-08', total_estimate: 2 })],
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: h.loadMore }))
    await screen.findAllByText(/08\/10\/2026/)
    expect(screen.getAllByRole('listitem').filter((li) => li.matches('ul > li'))).toHaveLength(2)
    expect(mocked).toHaveBeenLastCalledWith('e1', null, 10, 1)
    expect(screen.queryByRole('button', { name: h.loadMore })).not.toBeInTheDocument()
  })

  it('sin historia lo dice sin inventar datos ni recomendar nada', async () => {
    mocked.mockResolvedValue({ total: 0, entries: [] })
    renderPage()
    expect(await screen.findByText(h.empty)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('muestra un error con «Reintentar»', async () => {
    mocked.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(h.loadError)).toBeInTheDocument()
    mocked.mockResolvedValue({ total: 1, entries: [entry({})] })
    await user.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(
      await screen.findByText(/Press banca/, { selector: 'p.font-medium' }),
    ).toBeInTheDocument()
  })
})
