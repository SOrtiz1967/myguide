// Spec 018: plan semanal y «marcar como completado» (FR-001 a FR-013).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  fetchRoutines,
  fetchSessionsOfDay,
  fetchWeeklyPlan,
  markWorkoutDone,
  setWeeklyPlanDay,
  type Routine,
  type SessionSummary,
} from '../../src/features/training/api'
import { WeeklyPlanPanel } from '../../src/features/training/WeeklyPlanPanel'
import { WorkoutDayActions } from '../../src/features/training/WorkoutDayActions'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchRoutines: vi.fn(),
  fetchSessionsOfDay: vi.fn(),
  fetchWeeklyPlan: vi.fn(),
  setWeeklyPlanDay: vi.fn(),
  markWorkoutDone: vi.fn(),
}))

const p = es.training.weeklyPlan
const td = es.training.today

// 2026-10-28 es miércoles (weekday 3); 2026-10-26 es lunes (1).
const TODAY = '2026-10-28'

const routine = (id: string, name: string, count = 2): Routine => ({
  id,
  name,
  created_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-20T00:00:00Z',
  routine_exercises: Array.from({ length: count }, (_, i) => ({
    id: `${id}-e${i}`,
    routine_id: id,
    position: i + 1,
    exercise_id: null,
    exercise_name: `Ejercicio ${i + 1}`,
    measurement_type: 'reps_weight' as const,
    sets: 3,
    target_reps: null,
    target_weight_kg: null,
    target_duration_s: null,
    target_distance_km: null,
    exercise: null,
  })),
})

const session = (over: Partial<SessionSummary> = {}): SessionSummary => ({
  id: 's1',
  session_date: TODAY,
  original_date: TODAY,
  status: 'completed',
  routine_name: 'Pecho',
  has_plan: true,
  modified: false,
  rescheduled_count: 0,
  corrected_at: null,
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
  vi.mocked(fetchRoutines).mockResolvedValue([routine('r1', 'Pecho'), routine('r2', 'Espalda')])
  vi.mocked(fetchWeeklyPlan).mockResolvedValue([])
  vi.mocked(fetchSessionsOfDay).mockResolvedValue([])
  vi.mocked(setWeeklyPlanDay).mockResolvedValue({})
  vi.mocked(markWorkoutDone).mockResolvedValue({
    id: 'nueva',
    session_date: TODAY,
    status: 'completed',
    revision: 1,
  })
})
afterEach(() => vi.clearAllMocks())

describe('plan semanal', () => {
  it('muestra los siete días con «Sin rutina» y las rutinas para elegir', async () => {
    renderWith(<WeeklyPlanPanel />)
    const monday = await screen.findByLabelText('Lunes')
    expect(monday).toHaveValue('')
    for (const day of p.weekdays) expect(screen.getByLabelText(day)).toBeInTheDocument()
    expect(within(monday).getByRole('option', { name: p.none })).toBeInTheDocument()
    expect(within(monday).getByRole('option', { name: 'Pecho' })).toBeInTheDocument()
  })

  it('FR-001: elegir una rutina asigna ese día de la semana y lo avisa', async () => {
    renderWith(<WeeklyPlanPanel />)
    await userEvent.selectOptions(await screen.findByLabelText('Jueves'), 'r2')
    expect(setWeeklyPlanDay).toHaveBeenCalledWith(4, 'r2')
    expect(await screen.findByText(p.saved)).toBeInTheDocument()
  })

  it('FR-003: quitar la rutina manda null', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 1, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    renderWith(<WeeklyPlanPanel />)
    const monday = await screen.findByLabelText('Lunes')
    expect(monday).toHaveValue('r1')
    await userEvent.selectOptions(monday, '')
    expect(setWeeklyPlanDay).toHaveBeenCalledWith(1, null)
  })

  it('FR-005: una rutina eliminada deja el día sin rutina y lo dice con su último nombre', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 2, routine_id: null, routine_name: 'Piernas' },
    ])
    renderWith(<WeeklyPlanPanel />)
    expect(await screen.findByText(p.goneRoutine('Piernas'))).toBeInTheDocument()
    expect(screen.getByLabelText('Martes')).toHaveValue('')
  })

  it('sin rutinas ofrece armar la primera', async () => {
    vi.mocked(fetchRoutines).mockResolvedValue([])
    renderWith(<WeeklyPlanPanel />)
    expect(await screen.findByText(p.noRoutinesTitle)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: p.createRoutine })).toHaveAttribute(
      'href',
      '/entrenamiento/rutinas/nueva',
    )
  })

  it('si no se puede guardar lo dice y no da el plan por guardado', async () => {
    vi.mocked(setWeeklyPlanDay).mockRejectedValue(new Error('x'))
    renderWith(<WeeklyPlanPanel />)
    await userEvent.selectOptions(await screen.findByLabelText('Lunes'), 'r1')
    expect(await screen.findByText(p.saveFailed)).toBeInTheDocument()
    expect(screen.queryByText(p.saved)).not.toBeInTheDocument()
  })
})

describe('entrenamiento del día', () => {
  it('FR-006/FR-007: con rutina asignada ofrece marcar como completado y «otro entrenamiento»', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 3, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    renderWith(<WorkoutDayActions date={TODAY} today={TODAY} showCompleted />)
    expect(await screen.findByText(td.planned('Pecho'))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(td.exerciseCount(2)))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: td.markDone })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: td.other })).toBeInTheDocument()
    // Sin cargar otro, no se muestra la lista de rutinas.
    expect(screen.queryByText(td.loadTitle)).not.toBeInTheDocument()
  })

  it('FR-008/FR-010: marcar manda la rutina de hoy y un doble toque repite la misma solicitud', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 3, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    renderWith(<WorkoutDayActions date={TODAY} today={TODAY} showCompleted />)
    const button = await screen.findByRole('button', { name: td.markDone })
    await userEvent.dblClick(button)
    const calls = vi.mocked(markWorkoutDone).mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(1)
    // El servidor es idempotente por solicitud: todos los toques llevan el mismo identificador.
    expect(new Set(calls.map((call) => call[2])).size).toBe(1)
    expect(calls[0]?.slice(0, 2)).toEqual(['r1', null])
  })

  it('un día pasado manda su fecha al marcar', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 1, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    renderWith(<WorkoutDayActions date="2026-10-26" today={TODAY} />)
    await userEvent.click(await screen.findByRole('button', { name: td.markDone }))
    expect(markWorkoutDone).toHaveBeenCalledWith('r1', '2026-10-26', expect.any(String))
  })

  it('FR-011: sin rutina asignada no hay «marcar como completado» y sí cargar con las rutinas', async () => {
    renderWith(<WorkoutDayActions date={TODAY} today={TODAY} showCompleted />)
    expect(await screen.findByText(td.loadTitle)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: td.markDone })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: td.markRoutine('Espalda') }))
    expect(markWorkoutDone).toHaveBeenCalledWith('r2', null, expect.any(String))
    expect(screen.getByRole('link', { name: td.newRoutine })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.training.home.startEmpty })).toBeInTheDocument()
  })

  it('FR-012: «Hice otro entrenamiento» abre las opciones y no toca el plan', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 3, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    renderWith(<WorkoutDayActions date={TODAY} today={TODAY} />)
    await userEvent.click(await screen.findByRole('button', { name: td.other }))
    expect(await screen.findByText(td.loadTitle)).toBeInTheDocument()
    expect(setWeeklyPlanDay).not.toHaveBeenCalled()
  })

  it('con una sesión realizada hoy no vuelve a ofrecer marcar y la muestra sin detalle', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 3, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([session({ marked_complete: true })])
    renderWith(<WorkoutDayActions date={TODAY} today={TODAY} showCompleted />)
    expect(await screen.findByText(td.doneTitle)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(es.training.marks.markedComplete))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: td.markDone })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: td.load })).toBeInTheDocument()
  })

  it('FR-018: una sesión planificada a mano manda sobre el plan semanal', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 3, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([session({ status: 'planned' })])
    renderWith(<WorkoutDayActions date={TODAY} today={TODAY} showCompleted />)
    await screen.findByText(td.planOf, undefined, { timeout: 200 }).catch(() => undefined)
    expect(screen.queryByRole('button', { name: td.markDone })).not.toBeInTheDocument()
  })

  it('FR-013: un día futuro solo muestra lo que toca', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 4, routine_id: 'r2', routine_name: 'Espalda' },
    ])
    renderWith(<WorkoutDayActions date="2026-10-29" today={TODAY} />)
    expect(await screen.findByText(td.planFuture('Espalda'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: td.markDone })).not.toBeInTheDocument()
  })

  it('con una sesión en curso solo se ofrece continuar: no se empieza otra', async () => {
    vi.mocked(fetchWeeklyPlan).mockResolvedValue([
      { weekday: 3, routine_id: 'r1', routine_name: 'Pecho' },
    ])
    renderWith(<WorkoutDayActions date={TODAY} today={TODAY} hasOpenSession />)
    await screen.findByText(/./, undefined, { timeout: 200 }).catch(() => undefined)
    expect(screen.queryByRole('button', { name: td.markDone })).not.toBeInTheDocument()
    expect(screen.queryByText(td.loadTitle)).not.toBeInTheDocument()
  })
})
