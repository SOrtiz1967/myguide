// T070 (spec 006, escenarios 40 y 41): corregir una sesión realizada y eliminar una sesión.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  deleteSession,
  fetchSession,
  saveWorkout,
  type WorkoutSession,
} from '../../src/features/training/api'
import { SessionPage } from '../../src/features/training/SessionPage'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchSession: vi.fn(),
  saveWorkout: vi.fn(),
  deleteSession: vi.fn(),
}))
vi.mock('../../src/features/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}))

const s = es.training.session
const mockedFetch = vi.mocked(fetchSession)

const completed: WorkoutSession = {
  id: 's1',
  session_date: '2026-10-10',
  original_date: '2026-10-10',
  status: 'completed',
  routine_name: null,
  routine_id: null,
  has_plan: false,
  modified: false,
  rescheduled_count: 0,
  corrected_at: null,
  note: null,
  started_at: '2026-10-10T10:00:00Z',
  finished_at: '2026-10-10T11:00:00Z',
  revision: 3,
  session_plan_items: [],
  session_date_changes: [],
  session_exercises: [
    {
      id: 'x1',
      position: 1,
      exercise_id: 'e1',
      exercise_name: 'Press guardado',
      measurement_type: 'reps_weight',
      plan_item_id: null,
      is_substitute: false,
      effort: null,
      note: null,
      session_sets: [
        { id: 't1', position: 1, reps: 8, weight_kg: 60, duration_s: null, distance_km: null },
      ],
    },
  ],
}

function renderSession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/entrenamiento/sesion/s1']}>
        <Routes>
          <Route path="/entrenamiento/sesion/:id" element={<SessionPage />} />
          <Route path="/entrenamiento" element={<p>INICIO DE ENTRENAMIENTO</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  mockedFetch.mockResolvedValue(completed)
})
afterEach(() => vi.clearAllMocks())

describe('corregir una sesión realizada', () => {
  it('«Corregir» reabre el editor; el nombre y el tipo guardados no se editan', async () => {
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: s.correct }))
    expect(screen.getByText(s.correcting)).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Press guardado' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /nombre/i })).not.toBeInTheDocument()
    expect(
      screen.getByLabelText(es.training.editor.fieldOfSet(es.training.fields.reps, 1)),
    ).toHaveValue('8')
  })

  it('guardar la corrección vuelve a la sesión y muestra «Corregida» con su fecha', async () => {
    vi.mocked(saveWorkout).mockResolvedValue({
      revision: 4,
      status: 'completed',
      modified: false,
      corrected_at: '2026-10-21T12:00:00Z',
      finished_at: '2026-10-10T11:00:00Z',
    })
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: s.correct }))
    const reps = screen.getByLabelText(es.training.editor.fieldOfSet(es.training.fields.reps, 1))
    await user.clear(reps)
    await user.type(reps, '10')
    mockedFetch.mockResolvedValue({
      ...completed,
      revision: 4,
      corrected_at: '2026-10-21T12:00:00Z',
    })
    await user.click(screen.getByRole('button', { name: s.finishCorrection }))
    expect(await screen.findByText(/Corregida el \d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument()
    expect(saveWorkout).toHaveBeenCalled()
    expect(vi.mocked(saveWorkout).mock.calls.at(-1)![2]).toBe(3)
  })
})

describe('eliminar una sesión', () => {
  it('pide confirmación, se puede cancelar con Escape y devuelve el foco', async () => {
    const user = userEvent.setup()
    renderSession()
    const open = await screen.findByRole('button', { name: s.delete })
    await user.click(open)
    const dialog = screen.getByRole('dialog', { name: s.confirmDeleteTitle })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: s.cancelDelete })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(open).toHaveFocus()
    expect(deleteSession).not.toHaveBeenCalled()
  })

  it('confirmar elimina y vuelve al inicio con un aviso', async () => {
    vi.mocked(deleteSession).mockResolvedValue()
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: s.delete }))
    await user.click(screen.getByRole('button', { name: s.confirmDelete }))
    expect(deleteSession).toHaveBeenCalledWith('s1')
    expect(await screen.findByText('INICIO DE ENTRENAMIENTO')).toBeInTheDocument()
  })

  it('si falla, avisa con claridad y la sesión sigue ahí', async () => {
    vi.mocked(deleteSession).mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: s.delete }))
    await user.click(screen.getByRole('button', { name: s.confirmDelete }))
    expect(await screen.findByText(s.deleteFailed)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
