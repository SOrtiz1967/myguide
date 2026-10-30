// Spec 021: recordatorios — configuración en el perfil y tarjetas en el inicio (FR-001 a FR-013).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchLastWeight } from '../../src/features/measures/api'
import {
  fetchLastPhotoDate,
  fetchReminders,
  saveReminder,
  snoozeReminder,
} from '../../src/features/reminders/api'
import type { Reminder } from '../../src/features/reminders/due'
import { ReminderCards } from '../../src/features/reminders/ReminderCards'
import { RemindersSection } from '../../src/features/reminders/RemindersSection'
import { fetchMarks, fetchSupplements } from '../../src/features/supplements/api'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/reminders/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/reminders/api')>()),
  fetchReminders: vi.fn(),
  fetchLastPhotoDate: vi.fn(),
  saveReminder: vi.fn(),
  snoozeReminder: vi.fn(),
}))
vi.mock('../../src/features/measures/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/measures/api')>()),
  fetchLastWeight: vi.fn(),
}))
vi.mock('../../src/features/supplements/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/supplements/api')>()),
  fetchSupplements: vi.fn(),
  fetchMarks: vi.fn(),
}))

const c = es.reminders
const TODAY = '2026-10-30' // viernes

const reminder = (over: Partial<Reminder>): Reminder => ({
  kind: 'weight',
  enabled: true,
  frequency: 'daily',
  every_n: null,
  weekdays: null,
  snoozed_until: null,
  ...over,
})

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchReminders).mockReset().mockResolvedValue([])
  vi.mocked(fetchLastPhotoDate).mockReset().mockResolvedValue(null)
  vi.mocked(saveReminder).mockReset().mockResolvedValue(undefined)
  vi.mocked(snoozeReminder).mockReset().mockResolvedValue(undefined)
  vi.mocked(fetchLastWeight).mockReset().mockResolvedValue(null)
  vi.mocked(fetchSupplements).mockReset().mockResolvedValue([])
  vi.mocked(fetchMarks).mockReset().mockResolvedValue([])
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

describe('configuración en el perfil', () => {
  it('muestra los tres recordatorios, apagados si no hay ninguno', async () => {
    renderWith(<RemindersSection />)
    for (const kind of ['weight', 'photos', 'supplements'] as const) {
      expect(await screen.findByLabelText(c.enable[kind])).not.toBeChecked()
    }
    expect(screen.getByText(c.limitNote)).toBeVisible()
  })

  it('activa el peso todos los días y lo guarda', async () => {
    const user = userEvent.setup()
    renderWith(<RemindersSection />)
    await user.click(await screen.findByLabelText(c.enable.weight))
    await user.click(screen.getByRole('button', { name: c.save('Peso') }))
    await waitFor(() =>
      expect(saveReminder).toHaveBeenCalledWith({
        kind: 'weight',
        enabled: true,
        frequency: 'daily',
        everyN: 7,
        weekdays: [],
      }),
    )
    expect(await screen.findByText(c.saved('Peso'))).toBeVisible()
  })

  it('«cada tantos días» valida de 2 a 30 antes de llamar al servidor', async () => {
    const user = userEvent.setup()
    renderWith(<RemindersSection />)
    await user.click(await screen.findByLabelText(c.enable.photos))
    await user.selectOptions(screen.getByLabelText(c.frequencyLabel), 'every_n_days')
    const input = screen.getByLabelText(c.everyN)
    await user.clear(input)
    await user.type(input, '1')
    await user.click(screen.getByRole('button', { name: c.save('Fotos de progreso') }))
    expect(await screen.findByText(new RegExp(c.errors.every_n_invalid))).toBeVisible()
    await user.clear(input)
    await user.type(input, '31')
    await user.click(screen.getByRole('button', { name: c.save('Fotos de progreso') }))
    expect(await screen.findByText(new RegExp(c.errors.every_n_invalid))).toBeVisible()
    expect(saveReminder).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, '14')
    await user.click(screen.getByRole('button', { name: c.save('Fotos de progreso') }))
    await waitFor(() =>
      expect(saveReminder).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'photos', frequency: 'every_n_days', everyN: 14 }),
      ),
    )
  })

  it('«ciertos días» exige al menos un día y manda los elegidos', async () => {
    const user = userEvent.setup()
    renderWith(<RemindersSection />)
    await user.click(await screen.findByLabelText(c.enable.supplements))
    await user.selectOptions(screen.getByLabelText(c.frequencyLabel), 'weekdays')
    await user.click(screen.getByRole('button', { name: c.save('Suplementos') }))
    expect(await screen.findByText(new RegExp(c.errors.weekdays_invalid))).toBeVisible()
    expect(saveReminder).not.toHaveBeenCalled()
    const days = within(screen.getByRole('group', { name: c.weekdaysLabel }))
    await user.click(days.getByLabelText('Miércoles'))
    await user.click(days.getByLabelText('Lunes'))
    await user.click(screen.getByRole('button', { name: c.save('Suplementos') }))
    await waitFor(() =>
      expect(saveReminder).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'supplements', frequency: 'weekdays', weekdays: [1, 3] }),
      ),
    )
  })

  it('los suplementos no ofrecen «cada tantos días»', async () => {
    const user = userEvent.setup()
    renderWith(<RemindersSection />)
    await user.click(await screen.findByLabelText(c.enable.supplements))
    const options = within(screen.getByLabelText(c.frequencyLabel)).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([c.frequencies.daily, c.frequencies.weekdays])
  })

  it('muestra lo ya configurado', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([
      reminder({ kind: 'photos', frequency: 'every_n_days', every_n: 14 }),
    ])
    renderWith(<RemindersSection />)
    expect(await screen.findByLabelText(c.enable.photos)).toBeChecked()
    expect(screen.getByLabelText(c.everyN)).toHaveValue(14)
  })

  it('si no se pudo guardar lo dice y no da el recordatorio por guardado', async () => {
    vi.mocked(saveReminder).mockRejectedValue(new WriteError(true, es.errors.offline))
    const user = userEvent.setup()
    renderWith(<RemindersSection />)
    await user.click(await screen.findByLabelText(c.enable.weight))
    await user.click(screen.getByRole('button', { name: c.save('Peso') }))
    expect(await screen.findByText(new RegExp(es.errors.offline))).toBeVisible()
    expect(screen.queryByText(c.saved('Peso'))).not.toBeInTheDocument()
  })

  it('si falla la carga muestra un error con reintento', async () => {
    vi.mocked(fetchReminders).mockRejectedValueOnce(new Error('x'))
    renderWith(<RemindersSection />)
    expect(await screen.findByText(c.loadError)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByLabelText(c.enable.weight)).toBeInTheDocument()
  })
})

describe('tarjetas del inicio', () => {
  const cards = () => renderWith(<ReminderCards today={TODAY} />)

  it('sin recordatorios no muestra nada', async () => {
    cards()
    await waitFor(() => expect(fetchReminders).toHaveBeenCalled())
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('peso diario sin peso de hoy: tarjeta con acceso directo y texto opcional', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([reminder({})])
    cards()
    const card = await screen.findByRole('region', { name: c.card.names.weight })
    expect(within(card).getByText(c.card.text.weight)).toBeVisible()
    expect(within(card).getByRole('link', { name: c.card.weightAction })).toHaveAttribute(
      'href',
      '/medidas',
    )
  })

  it('con el peso de hoy ya registrado no hay tarjeta', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([reminder({})])
    vi.mocked(fetchLastWeight).mockResolvedValue({
      id: 'w',
      kind: 'weight',
      value: 72,
      measured_on: TODAY,
      note: null,
      fasting: false,
    })
    cards()
    await waitFor(() => expect(fetchLastWeight).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: c.card.names.weight })).not.toBeInTheDocument(),
    )
  })

  it('fotos cada 14 días: corresponde con la última foto hace 14 y no hace 13', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([
      reminder({ kind: 'photos', frequency: 'every_n_days', every_n: 14 }),
    ])
    vi.mocked(fetchLastPhotoDate).mockResolvedValue('2026-10-16')
    const first = cards()
    expect(await screen.findByRole('region', { name: c.card.names.photos })).toBeVisible()
    first.unmount()
    vi.mocked(fetchLastPhotoDate).mockResolvedValue('2026-10-17')
    cards()
    await waitFor(() => expect(fetchLastPhotoDate).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('region', { name: c.card.names.photos })).not.toBeInTheDocument()
  })

  it('suplementos: corresponde con alguno sin marcar y no si están todos marcados o no hay ninguno', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([reminder({ kind: 'supplements' })])
    vi.mocked(fetchSupplements).mockResolvedValue([
      { id: 's1', name: 'Creatina', dose: null, archived_at: null },
      { id: 's2', name: 'Vitamina D', dose: null, archived_at: null },
    ])
    vi.mocked(fetchMarks).mockResolvedValue(['s1'])
    const first = cards()
    const card = await screen.findByRole('region', { name: c.card.names.supplements })
    expect(within(card).queryByRole('link')).not.toBeInTheDocument()
    first.unmount()

    vi.mocked(fetchMarks).mockResolvedValue(['s1', 's2'])
    const second = cards()
    await waitFor(() => expect(fetchMarks).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('region', { name: c.card.names.supplements })).not.toBeInTheDocument()
    second.unmount()

    vi.mocked(fetchSupplements).mockResolvedValue([])
    cards()
    await waitFor(() => expect(fetchSupplements).toHaveBeenCalledTimes(3))
    expect(screen.queryByRole('region', { name: c.card.names.supplements })).not.toBeInTheDocument()
  })

  it('varios avisos van en el orden peso, fotos y suplementos', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([
      reminder({ kind: 'supplements' }),
      reminder({ kind: 'photos' }),
      reminder({ kind: 'weight' }),
    ])
    vi.mocked(fetchSupplements).mockResolvedValue([
      { id: 's1', name: 'Creatina', dose: null, archived_at: null },
    ])
    cards()
    for (const name of Object.values(c.card.names)) {
      await screen.findByRole('region', { name })
    }
    const names = screen
      .getAllByRole('region')
      .map((r) => r.getAttribute('aria-label'))
      .filter((n) => n !== c.card.region)
    expect(names).toEqual([c.card.names.weight, c.card.names.photos, c.card.names.supplements])
  })

  it('«Más tarde» pospone ese aviso', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([reminder({})])
    const user = userEvent.setup()
    cards()
    await screen.findByRole('region', { name: c.card.names.weight })
    await user.click(
      screen.getByRole('button', { name: `${c.card.later}: ${c.card.names.weight}` }),
    )
    await waitFor(() => expect(snoozeReminder).toHaveBeenCalledWith('weight'))
  })

  it('«Desactivar» lo apaga conservando su configuración', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([
      reminder({ frequency: 'weekdays', weekdays: [1, 3, 5] }),
    ])
    const user = userEvent.setup()
    cards()
    await screen.findByRole('region', { name: c.card.names.weight })
    await user.click(
      screen.getByRole('button', { name: `${c.card.disable}: ${c.card.names.weight}` }),
    )
    await waitFor(() =>
      expect(saveReminder).toHaveBeenCalledWith({
        kind: 'weight',
        enabled: false,
        frequency: 'weekdays',
        everyN: null,
        weekdays: [1, 3, 5],
      }),
    )
  })

  it('un aviso pospuesto o apagado no se muestra', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([
      reminder({ kind: 'weight', snoozed_until: '2026-10-31' }),
      reminder({ kind: 'photos', enabled: false }),
    ])
    cards()
    await waitFor(() => expect(fetchReminders).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: c.card.names.weight })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: c.card.names.photos })).not.toBeInTheDocument()
  })

  it('si falla al guardar «Más tarde» lo dice', async () => {
    vi.mocked(fetchReminders).mockResolvedValue([reminder({})])
    vi.mocked(snoozeReminder).mockRejectedValue(new WriteError(true, es.errors.offline))
    const user = userEvent.setup()
    cards()
    await screen.findByRole('region', { name: c.card.names.weight })
    await user.click(
      screen.getByRole('button', { name: `${c.card.later}: ${c.card.names.weight}` }),
    )
    expect(await screen.findByText(es.errors.offline)).toBeVisible()
  })

  it('si falla leer los recordatorios no muestra nada ni rompe', async () => {
    vi.mocked(fetchReminders).mockRejectedValue(new Error('x'))
    cards()
    await waitFor(() => expect(fetchReminders).toHaveBeenCalled())
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('los textos no tienen culpa, urgencia ni conteo de días', () => {
    expect(JSON.stringify(c)).not.toMatch(
      /olvidaste|no cumpliste|llevas \d|racha|urgente|¡|!|obligatorio|debes|deberías/i,
    )
    for (const text of Object.values(c.card.text)) expect(text).toMatch(/opcional/)
  })
})
