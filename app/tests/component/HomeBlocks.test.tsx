// T004 a T008 (spec 013): el inicio «Hoy» — calorías, entrenamiento, accesos y últimos registros, cada bloque por su cuenta.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchGoalHistory } from '../../src/features/goals/api'
import {
  fetchDayEntries,
  fetchDayStatus,
  fetchEntriesBetween,
  fetchLastEntry,
} from '../../src/features/meals/api'
import { fetchWeightsBetween } from '../../src/features/measures/api'
import { fetchProfile } from '../../src/features/profile/api'
import {
  fetchDueSessions,
  fetchInProgressSession,
  fetchRecentSessions,
  fetchRoutines,
  fetchSessionsBetween,
  type SessionSummary,
} from '../../src/features/training/api'
import { HomePage } from '../../src/routes/HomePage'

vi.mock('../../src/features/profile/api', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))
vi.mock('../../src/features/goals/api', () => ({ fetchGoalHistory: vi.fn() }))
vi.mock('../../src/features/meals/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/meals/api')>()),
  fetchDayEntries: vi.fn(),
  fetchDayStatus: vi.fn(),
  fetchLastEntry: vi.fn(),
  fetchEntriesBetween: vi.fn(),
}))
vi.mock('../../src/features/measures/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/measures/api')>()),
  fetchWeightsBetween: vi.fn(),
}))
vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchInProgressSession: vi.fn(),
  fetchDueSessions: vi.fn(),
  fetchRecentSessions: vi.fn(),
  fetchRoutines: vi.fn(),
  fetchSessionsBetween: vi.fn(),
  fetchSessionsOfDay: vi.fn(),
}))

const h = es.home
const today = new Intl.DateTimeFormat('en-CA').format(new Date())

const entry = (over: Record<string, unknown> = {}) =>
  ({
    id: 'e1',
    log_date: today,
    meal: 'lunch',
    origin: 'manual',
    status: 'confirmed',
    food_name: 'Arroz con pollo',
    energy_kcal: 500,
    created_at: '2026-10-26T12:00:00Z',
    ...over,
  }) as never

const session = (over: Partial<SessionSummary> = {}): SessionSummary => ({
  id: 's1',
  session_date: today,
  original_date: today,
  status: 'planned',
  routine_name: 'Torso A',
  has_plan: true,
  modified: false,
  rescheduled_count: 0,
  corrected_at: null,
  ...over,
})

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchProfile).mockResolvedValue({
    user_id: 'u1',
    birth_date: '1990-05-17',
    sex: null,
    height_cm: 171.5,
    timezone: 'America/Argentina/Buenos_Aires',
    unit_system: 'metric',
    onboarding_completed_at: '2026-10-20T00:00:00Z',
    weight_reminder: false,
    goal_type: null,
    experience: null,
    job_activity: null,
    training_days: null,
    privacy_notice_version: 'v',
    privacy_notice_accepted_at: '2026-10-16T12:00:00Z',
    email_verified_at: '2026-10-16T12:00:00Z',
    last_active_at: '2026-10-16T12:00:00Z',
    created_at: '2026-10-16T12:00:00Z',
    updated_at: '2026-10-16T12:00:00Z',
  })
  vi.mocked(fetchDayStatus).mockResolvedValue({ today, proposed_date: today, closing: false })
  vi.mocked(fetchDayEntries).mockResolvedValue([])
  vi.mocked(fetchGoalHistory).mockResolvedValue([])
  vi.mocked(fetchLastEntry).mockResolvedValue(null)
  vi.mocked(fetchInProgressSession).mockResolvedValue(null)
  vi.mocked(fetchDueSessions).mockResolvedValue([])
  vi.mocked(fetchRecentSessions).mockResolvedValue([])
  vi.mocked(fetchRoutines).mockResolvedValue([])
  vi.mocked(fetchEntriesBetween).mockResolvedValue([])
  vi.mocked(fetchWeightsBetween).mockResolvedValue([])
  vi.mocked(fetchSessionsBetween).mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('calorías de hoy', () => {
  it('con objetivo y comidas muestra las cifras de la tarjeta del día y los enlaces', async () => {
    vi.mocked(fetchDayEntries).mockResolvedValue([entry(), entry({ id: 'e2', energy_kcal: 300 })])
    vi.mocked(fetchGoalHistory).mockResolvedValue([
      { effective_from: '2026-01-01', kcal: 2000, created_at: '2026-01-01T00:00:00Z' },
    ])
    renderHome()
    expect(await screen.findByText(es.goal.registered(800, false))).toBeInTheDocument()
    expect(screen.getByText(es.goal.goalLine(2000))).toBeInTheDocument()
    expect(screen.getByText(es.goal.percent(40))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: h.calories.openDay })).toHaveAttribute(
      'href',
      `/comidas/${today}`,
    )
    expect(screen.getByRole('link', { name: h.calories.register })).toHaveAttribute(
      'href',
      `/comidas/${today}/agregar`,
    )
  })

  it('sin objetivo muestra solo lo registrado y la invitación a fijarlo', async () => {
    vi.mocked(fetchDayEntries).mockResolvedValue([entry()])
    renderHome()
    expect(await screen.findByText(es.goal.registered(500, false))).toBeInTheDocument()
    expect(screen.queryByText(es.goal.goalLine(2000))).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.goal.invite })).toBeInTheDocument()
  })

  it('sin comidas hoy lo dice y ofrece registrar, sin mostrar un total', async () => {
    renderHome()
    expect(await screen.findByText(h.calories.empty)).toBeInTheDocument()
    expect(screen.queryByText(/^Registrado:/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: h.calories.register })).toBeInTheDocument()
  })

  it('si falla, muestra el error con «Reintentar» y el resto del inicio sigue', async () => {
    vi.mocked(fetchDayEntries).mockRejectedValueOnce(new Error('boom'))
    vi.mocked(fetchInProgressSession).mockResolvedValue(session({ status: 'in_progress' }))
    const user = userEvent.setup()
    renderHome()
    const block = (await screen.findByRole('region', { name: h.calories.title })).closest(
      'section',
    )!
    expect(await within(block).findByText(h.loadError)).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: es.training.home.continue })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: es.week.title })).toBeInTheDocument()

    vi.mocked(fetchDayEntries).mockResolvedValue([entry()])
    await user.click(within(block).getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByText(es.goal.registered(500, false))).toBeInTheDocument()
  })
})

describe('entrenamiento de hoy', () => {
  it('con una sesión en curso destaca continuarla', async () => {
    vi.mocked(fetchInProgressSession).mockResolvedValue(
      session({ id: 'abierta', status: 'in_progress' }),
    )
    renderHome()
    expect(await screen.findByText(h.training.continueTitle)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.training.home.continue })).toHaveAttribute(
      'href',
      '/entrenamiento/sesion/abierta',
    )
  })

  it('lista las planificadas de hoy y las vencidas con sus acciones', async () => {
    vi.mocked(fetchDueSessions).mockResolvedValue([
      session({ id: 'p1', session_date: '2026-01-01' }),
      session({ id: 'p2' }),
    ])
    renderHome()
    expect(await screen.findByText(new RegExp(es.training.overdue))).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: es.training.planning.cancel })).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: es.training.planning.registerAction }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.training.planning.start })).toBeInTheDocument()
  })

  it('sin nada planificado invita a empezar con una rutina o una sesión vacía', async () => {
    renderHome()
    expect(await screen.findByText(h.training.empty)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.training.home.startEmpty })).toBeInTheDocument()
    expect(await screen.findByText(es.training.home.noRoutines)).toBeInTheDocument()
  })

  it('si falla, el bloque muestra su error y las calorías siguen', async () => {
    vi.mocked(fetchInProgressSession).mockRejectedValue(new Error('boom'))
    vi.mocked(fetchDayEntries).mockResolvedValue([entry()])
    renderHome()
    expect(await screen.findByText(es.goal.registered(500, false))).toBeInTheDocument()
    expect(await screen.findAllByText(h.loadError)).not.toHaveLength(0)
  })
})

describe('accesos rápidos y últimos registros', () => {
  it('el panel del día ofrece registrar peso, entreno y sueño', async () => {
    renderHome()
    expect(await screen.findByRole('link', { name: es.week.panel.addWeight })).toHaveAttribute(
      'href',
      '/medidas',
    )
    expect(screen.getByRole('link', { name: es.week.panel.addWorkout })).toHaveAttribute(
      'href',
      `/entrenamiento/dia/${today}`,
    )
    expect(screen.getByRole('link', { name: es.week.panel.addSleep })).toHaveAttribute(
      'href',
      '/actividad',
    )
    expect(await screen.findByRole('link', { name: h.calories.register })).toHaveAttribute(
      'href',
      `/comidas/${today}/agregar`,
    )
  })

  it('muestra el último ítem y la última sesión con sus fechas y enlaces', async () => {
    vi.mocked(fetchLastEntry).mockResolvedValue(entry({ log_date: '2026-10-23' }))
    vi.mocked(fetchRecentSessions).mockResolvedValue([
      session({ id: 'h1', status: 'completed', session_date: '2026-10-20', modified: true }),
    ])
    renderHome()
    const meal = await screen.findByRole('link', { name: /Última comida/ })
    expect(meal).toHaveAttribute('href', '/comidas/item/e1')
    expect(meal).toHaveTextContent('Arroz con pollo · Almuerzo · 23/10/2026')
    const last = screen.getByRole('link', { name: /Última sesión/ })
    expect(last).toHaveAttribute('href', '/entrenamiento/sesion/h1')
    expect(last).toHaveTextContent('20/10/2026 · Torso A · Modificada')
  })

  it('sin registros lo dice sin inventar datos', async () => {
    renderHome()
    expect(await screen.findByText(h.last.noMeal)).toBeInTheDocument()
    expect(await screen.findByText(h.last.noSession)).toBeInTheDocument()
  })
})

describe('sin conexión', () => {
  it('avisa y no presenta la semana ni los bloques de datos', async () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    renderHome()
    expect(await screen.findByText(h.offline)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: h.calories.title })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: es.week.title })).not.toBeInTheDocument()
    expect(fetchDayEntries).not.toHaveBeenCalled()
    expect(fetchEntriesBetween).not.toHaveBeenCalled()
    online.mockRestore()
  })
})
