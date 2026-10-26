// Spec 007: la pantalla de sueño, pasos y actividad — último valor, registrar, corregir, eliminar y errores.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  deleteActivity,
  fetchHistory,
  fetchLatest,
  saveActivity,
  updateActivity,
  type ActivityRecord,
} from '../../src/features/activity/api'
import { ActivityPage } from '../../src/features/activity/ActivityPage'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/activity/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/activity/api')>()),
  fetchLatest: vi.fn(),
  fetchHistory: vi.fn(),
  saveActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
}))
vi.mock('../../src/features/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}))

const a = es.activity
const today = new Intl.DateTimeFormat('en-CA').format(new Date())

const sleep = (over: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: 's1',
  kind: 'sleep',
  value: 450,
  activity_date: '2026-10-20',
  source: 'manual',
  note: null,
  ...over,
})
const none = { sleep: null, steps: null, active_minutes: null }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(fetchLatest).mockResolvedValue(none)
  vi.mocked(fetchHistory).mockResolvedValue({ rows: [], hasMore: false })
})
afterEach(() => vi.clearAllMocks())

describe('sueño, pasos y actividad', () => {
  it('sin registros dice «Sin dato» en cada tipo', async () => {
    renderPage()
    expect(await screen.findAllByText(a.noData)).toHaveLength(3)
    expect(await screen.findByText(a.history.empty)).toBeInTheDocument()
  })

  it('muestra lo último, el historial con su fuente y la nota', async () => {
    vi.mocked(fetchLatest).mockResolvedValue({ ...none, sleep: sleep() })
    vi.mocked(fetchHistory).mockResolvedValue({
      rows: [
        sleep(),
        sleep({ id: 's0', value: 405, activity_date: '2026-10-13', note: 'Interrumpido' }),
      ],
      hasMore: false,
    })
    renderPage()
    expect(await screen.findByText('7 h 30 min · 20/10/2026')).toBeInTheDocument()
    expect(await screen.findByText('13/10/2026: 6 h 45 min · Registro manual')).toBeInTheDocument()
    expect(screen.getByText('Interrumpido')).toBeInTheDocument()
  })

  it('registra el sueño como h:mm en minutos para el día de hoy', async () => {
    vi.mocked(saveActivity).mockResolvedValue(sleep())
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText(/^Horas dormidas/), '7:30')
    await user.click(screen.getByRole('button', { name: a.form.save }))
    expect(saveActivity).toHaveBeenCalledWith(
      { kind: 'sleep', value: 450, activityDate: today, note: '' },
      expect.any(String),
    )
    expect(await screen.findByText(a.form.saved)).toBeInTheDocument()
  })

  it('rechaza un valor inválido sin llamar al servidor', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText(/^Horas dormidas/), '25:00')
    await user.click(screen.getByRole('button', { name: a.form.save }))
    expect(await screen.findByText(/entre 1 minuto y 24 horas/)).toBeInTheDocument()
    expect(saveActivity).not.toHaveBeenCalled()
  })

  it('si no llega al servidor lo dice, no lo muestra como guardado y conserva lo escrito', async () => {
    vi.mocked(saveActivity).mockRejectedValue(new WriteError(true, es.errors.offline))
    const user = userEvent.setup()
    renderPage()
    const input = await screen.findByLabelText(/^Horas dormidas/)
    await user.type(input, '7:30')
    await user.click(screen.getByRole('button', { name: a.form.save }))
    expect(await screen.findByText(new RegExp(es.errors.offline))).toBeInTheDocument()
    expect(screen.queryByText(a.form.saved)).not.toBeInTheDocument()
    expect(input).toHaveValue('7:30')
  })

  it('un guardado seguido de otro usa solicitudes distintas', async () => {
    vi.mocked(saveActivity).mockResolvedValue(sleep())
    const user = userEvent.setup()
    renderPage()
    const input = await screen.findByLabelText(/^Horas dormidas/)
    await user.type(input, '7:30')
    await user.click(screen.getByRole('button', { name: a.form.save }))
    await screen.findByText(a.form.saved)
    await user.type(input, '8:00')
    await user.click(screen.getByRole('button', { name: a.form.save }))
    const ids = vi.mocked(saveActivity).mock.calls.map((call) => call[1])
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('corrige y elimina un registro', async () => {
    vi.mocked(fetchHistory).mockResolvedValue({ rows: [sleep()], hasMore: false })
    vi.mocked(updateActivity).mockResolvedValue(sleep({ value: 480 }))
    vi.mocked(deleteActivity).mockResolvedValue()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Corregir/ }))
    const input = screen.getByLabelText(/^Horas dormidas/)
    expect(input).toHaveValue('7:30')
    await user.clear(input)
    await user.type(input, '8:00')
    await user.click(screen.getByRole('button', { name: a.form.save }))
    expect(updateActivity).toHaveBeenCalledWith('s1', {
      value: 480,
      activityDate: '2026-10-20',
      note: '',
    })
    expect(await screen.findByText(a.form.corrected)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Eliminar/ }))
    const dialog = screen.getByRole('dialog', { name: a.delete.title })
    await user.click(within(dialog).getByRole('button', { name: a.delete.confirm }))
    expect(deleteActivity).toHaveBeenCalledWith('s1')
    expect(await screen.findByText(a.delete.done)).toBeInTheDocument()
  })

  it('cambia de tipo desde las tarjetas', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Pasos/ }))
    expect(fetchHistory).toHaveBeenLastCalledWith('steps', 0)
    expect(screen.getByLabelText(/^Pasos$/)).toBeInTheDocument()
  })
})
