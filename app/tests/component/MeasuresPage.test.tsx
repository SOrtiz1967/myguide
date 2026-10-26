// Spec 008 (versión mínima): la pantalla de peso y medidas — último valor, registrar, corregir, eliminar y errores.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  deleteMeasurement,
  fetchHistory,
  fetchLatest,
  saveMeasurement,
  updateMeasurement,
  type Measurement,
} from '../../src/features/measures/api'
import { MeasuresPage } from '../../src/features/measures/MeasuresPage'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/measures/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/measures/api')>()),
  fetchLatest: vi.fn(),
  fetchHistory: vi.fn(),
  saveMeasurement: vi.fn(),
  updateMeasurement: vi.fn(),
  deleteMeasurement: vi.fn(),
}))
vi.mock('../../src/features/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}))

const m = es.measures
const today = new Intl.DateTimeFormat('en-CA').format(new Date())

const weight = (over: Partial<Measurement> = {}): Measurement => ({
  id: 'w1',
  kind: 'weight',
  value: 72.4,
  measured_on: '2026-10-20',
  note: null,
  ...over,
})
const none = { weight: null, waist: null, hips: null, chest: null, arm: null, thigh: null }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MeasuresPage />
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

describe('peso y medidas', () => {
  it('sin registros dice «Sin dato» en cada medida y que el historial está vacío', async () => {
    renderPage()
    expect(await screen.findAllByText(m.noData)).toHaveLength(6)
    expect(await screen.findByText(m.history.empty)).toBeInTheDocument()
  })

  it('muestra lo último de cada medida y el historial de la elegida', async () => {
    vi.mocked(fetchLatest).mockResolvedValue({ ...none, weight: weight() })
    vi.mocked(fetchHistory).mockResolvedValue({
      rows: [
        weight(),
        weight({ id: 'w0', value: 73, measured_on: '2026-10-13', note: 'En ayunas' }),
      ],
      hasMore: false,
    })
    renderPage()
    expect(await screen.findByText('72,4 kg · 20/10/2026')).toBeInTheDocument()
    expect(await screen.findByText('13/10/2026: 73,0 kg')).toBeInTheDocument()
    expect(screen.getByText('En ayunas')).toBeInTheDocument()
  })

  it('registra un peso con coma y lo guarda con el día de hoy', async () => {
    vi.mocked(saveMeasurement).mockResolvedValue(weight())
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText(/^Valor \(kg\)/), '72,4')
    await user.click(screen.getByRole('button', { name: m.form.save }))
    expect(saveMeasurement).toHaveBeenCalledWith(
      { kind: 'weight', value: 72.4, measuredOn: today, note: '' },
      expect.any(String),
    )
    expect(await screen.findByText(m.form.saved)).toBeInTheDocument()
  })

  it('rechaza un valor fuera de rango sin llamar al servidor', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText(/^Valor \(kg\)/), '5')
    await user.click(screen.getByRole('button', { name: m.form.save }))
    expect(await screen.findByText(/20 y 500 kg/)).toBeInTheDocument()
    expect(saveMeasurement).not.toHaveBeenCalled()
  })

  it('si no llega al servidor lo dice, no lo muestra como guardado y conserva lo escrito', async () => {
    vi.mocked(saveMeasurement).mockRejectedValue(new WriteError(true, es.errors.offline))
    const user = userEvent.setup()
    renderPage()
    const input = await screen.findByLabelText(/^Valor \(kg\)/)
    await user.type(input, '72,4')
    await user.click(screen.getByRole('button', { name: m.form.save }))
    expect(await screen.findByText(new RegExp(es.errors.offline))).toBeInTheDocument()
    expect(screen.queryByText(m.form.saved)).not.toBeInTheDocument()
    expect(input).toHaveValue('72,4')
  })

  it('un doble clic guarda una sola vez', async () => {
    let finish: (value: Measurement) => void = () => {}
    vi.mocked(saveMeasurement).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText(/^Valor \(kg\)/), '72,4')
    await user.dblClick(screen.getByRole('button', { name: m.form.save }))
    expect(saveMeasurement).toHaveBeenCalledTimes(1)
    finish(weight())
  })

  it('corrige un registro con los datos cargados', async () => {
    vi.mocked(fetchHistory).mockResolvedValue({ rows: [weight()], hasMore: false })
    vi.mocked(updateMeasurement).mockResolvedValue(weight({ value: 72 }))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Corregir/ }))
    const input = screen.getByLabelText(/^Valor \(kg\)/)
    expect(input).toHaveValue('72,4')
    await user.clear(input)
    await user.type(input, '72')
    await user.click(screen.getByRole('button', { name: m.form.save }))
    expect(updateMeasurement).toHaveBeenCalledWith('w1', {
      value: 72,
      measuredOn: '2026-10-20',
      note: '',
    })
    expect(await screen.findByText(m.form.corrected)).toBeInTheDocument()
  })

  it('elimina con confirmación y avisa si falla', async () => {
    vi.mocked(fetchHistory).mockResolvedValue({ rows: [weight()], hasMore: false })
    vi.mocked(deleteMeasurement).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Eliminar/ }))
    const dialog = screen.getByRole('dialog', { name: m.delete.title })
    await user.click(within(dialog).getByRole('button', { name: m.delete.confirm }))
    expect(await within(dialog).findByText(m.delete.failed)).toBeInTheDocument()

    vi.mocked(deleteMeasurement).mockResolvedValue()
    await user.click(within(dialog).getByRole('button', { name: m.delete.confirm }))
    expect(await screen.findByText(m.delete.done)).toBeInTheDocument()
    expect(deleteMeasurement).toHaveBeenCalledWith('w1')
  })

  it('cambia de medida desde las tarjetas y usa su unidad', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Cintura/ }))
    expect(fetchHistory).toHaveBeenLastCalledWith('waist', 0)
    expect(screen.getByLabelText(/^Valor \(cm\)/)).toBeInTheDocument()
  })
})
