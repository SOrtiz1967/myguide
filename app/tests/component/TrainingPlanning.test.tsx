// T055 (spec 006, escenarios 28 a 35): la página de un día, reprogramar, cancelar y registrar una planificada.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  cancelWorkout,
  fetchRoutines,
  fetchSessionsOfDay,
  planWorkout,
  rescheduleWorkout,
  SessionInProgressError,
  setWorkoutRoutine,
  startPlannedWorkout,
  startWorkout,
  type Routine,
  type SessionSummary,
} from '../../src/features/training/api'
import { TrainingDayPage } from '../../src/features/training/DayPage'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchSessionsOfDay: vi.fn(),
  fetchRoutines: vi.fn(),
  planWorkout: vi.fn(),
  rescheduleWorkout: vi.fn(),
  cancelWorkout: vi.fn(),
  startPlannedWorkout: vi.fn(),
  startWorkout: vi.fn(),
  setWorkoutRoutine: vi.fn(),
}))

const p = es.training.planning
const routine = (id: string, name: string): Routine =>
  ({ id, name, routine_exercises: [{}, {}] }) as unknown as Routine

function summary(over: Partial<SessionSummary>): SessionSummary {
  return {
    id: 's1',
    session_date: '2026-10-25',
    original_date: '2026-10-25',
    status: 'planned',
    routine_name: 'Torso A',
    has_plan: true,
    modified: false,
    rescheduled_count: 0,
    corrected_at: null,
    ...over,
  }
}

function renderDay(day: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/entrenamiento/dia/${day}`]}>
        <Routes>
          <Route path="/entrenamiento/dia/:fecha" element={<TrainingDayPage />} />
          <Route path="/entrenamiento/sesion/:id" element={<p>PANTALLA DE SESION</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00'))
  vi.mocked(fetchRoutines).mockResolvedValue([routine('r1', 'Torso A'), routine('r2', 'Pierna A')])
  vi.mocked(fetchSessionsOfDay).mockResolvedValue([])
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('página de un día', () => {
  it('un día futuro ofrece planificar una rutina o una sesión vacía, sin duplicar con doble clic', async () => {
    let finish: (id: string) => void = () => {}
    vi.mocked(planWorkout).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderDay('2026-10-25')
    const button = await screen.findByRole('button', { name: new RegExp(p.planWith('Torso A')) })
    expect(screen.queryByRole('button', { name: p.register })).not.toBeInTheDocument()
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(planWorkout).toHaveBeenCalledTimes(1))
    expect(planWorkout).toHaveBeenCalledWith('2026-10-25', 'r1', expect.any(String))
    finish('nueva')
    expect(await screen.findByText(p.planned)).toBeInTheDocument()

    vi.mocked(planWorkout).mockResolvedValue('otra')
    await userEvent.setup().click(screen.getByRole('button', { name: p.planEmptySession }))
    expect(planWorkout).toHaveBeenLastCalledWith('2026-10-25', null, expect.any(String))
  })

  it('un día pasado solo ofrece registrar', async () => {
    vi.mocked(startWorkout).mockResolvedValue({
      id: 'n1',
      session_date: '2026-10-20',
      status: 'in_progress',
      revision: 1,
    })
    renderDay('2026-10-20')
    await screen.findByText(p.noSessions)
    expect(screen.queryByRole('button', { name: p.planEmptySession })).not.toBeInTheDocument()
    expect(screen.getByText(p.pastOnlyRegister)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: p.register }))
    expect(startWorkout).toHaveBeenCalledWith('2026-10-20', expect.any(String))
    expect(await screen.findByText('PANTALLA DE SESION')).toBeInTheDocument()
  })

  it('una fecha inválida muestra «No encontramos este entrenamiento»', async () => {
    renderDay('2026-02-31')
    expect(await screen.findByText(p.invalidDay)).toBeInTheDocument()
    expect(fetchSessionsOfDay).not.toHaveBeenCalled()
  })

  it('con una sesión abierta, registrar ofrece continuarla', async () => {
    vi.mocked(startWorkout).mockRejectedValue(new SessionInProgressError('abierta'))
    renderDay('2026-10-22')
    await userEvent.setup().click(await screen.findByRole('button', { name: p.register }))
    expect(await screen.findByText(es.training.errors.sessionInProgress)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.training.home.continue })).toHaveAttribute(
      'href',
      '/entrenamiento/sesion/abierta',
    )
  })
})

describe('sesión planificada', () => {
  it('reprogramar pide hoy o un día futuro y mueve la sesión', async () => {
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([summary({})])
    vi.mocked(rescheduleWorkout).mockResolvedValue({
      id: 's1',
      session_date: '2026-10-29',
      status: 'planned',
      rescheduled_count: 1,
    })
    const user = userEvent.setup()
    renderDay('2026-10-25')
    await user.click(await screen.findByRole('button', { name: p.reschedule }))
    const input = screen.getByLabelText(p.newDate)
    fireEvent.change(input, { target: { value: '2026-10-20' } })
    await user.click(screen.getByRole('button', { name: p.moveDate }))
    expect(screen.getByText(p.pastDate)).toBeInTheDocument()
    expect(rescheduleWorkout).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '2026-10-29' } })
    await user.click(screen.getByRole('button', { name: p.moveDate }))
    expect(rescheduleWorkout).toHaveBeenCalledWith('s1', '2026-10-29', expect.any(String))
    expect(await screen.findByText(p.moved)).toBeInTheDocument()
  })

  it('un movimiento que falla conserva la sesión y lo dice', async () => {
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([summary({})])
    vi.mocked(rescheduleWorkout).mockRejectedValue(new WriteError(true, es.errors.offline))
    const user = userEvent.setup()
    renderDay('2026-10-25')
    await user.click(await screen.findByRole('button', { name: p.reschedule }))
    await user.click(screen.getByRole('button', { name: p.moveDate }))
    expect(await screen.findByText(es.errors.offline)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: p.moveDate })).toBeEnabled()
  })

  it('cancelar avisa con calma y una cancelada se puede volver a planificar', async () => {
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([summary({})])
    vi.mocked(cancelWorkout).mockResolvedValue({
      id: 's1',
      session_date: '2026-10-25',
      status: 'cancelled',
      rescheduled_count: 0,
    })
    const user = userEvent.setup()
    renderDay('2026-10-25')
    await user.click(await screen.findByRole('button', { name: p.cancel }))
    expect(cancelWorkout).toHaveBeenCalledWith('s1')
    expect(await screen.findByText(p.cancelled)).toBeInTheDocument()
  })

  it('una cancelada ofrece «Volver a planificar»', async () => {
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([summary({ status: 'cancelled' })])
    vi.mocked(rescheduleWorkout).mockResolvedValue({
      id: 's1',
      session_date: '2026-10-25',
      status: 'planned',
      rescheduled_count: 0,
    })
    const user = userEvent.setup()
    renderDay('2026-10-25')
    await user.click(await screen.findByRole('button', { name: p.replan }))
    await user.click(screen.getByRole('button', { name: p.moveDate }))
    expect(rescheduleWorkout).toHaveBeenCalledWith('s1', '2026-10-25', expect.any(String))
  })

  it('«Sin registrar» ofrece registrar, reprogramar y cancelar; registrar pregunta qué día la hizo', async () => {
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([summary({ session_date: '2026-10-20' })])
    vi.mocked(startPlannedWorkout).mockResolvedValue({
      id: 's1',
      session_date: '2026-10-20',
      status: 'in_progress',
      revision: 1,
    })
    const user = userEvent.setup()
    renderDay('2026-10-20')
    expect(await screen.findByText(es.training.overdue)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: p.reschedule })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: p.cancel })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: p.start })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: p.registerAction }))
    const input = screen.getByLabelText(p.whichDay, { selector: 'input' })
    expect(input).toHaveValue('2026-10-22')
    fireEvent.change(input, { target: { value: '2026-10-23' } })
    await user.click(screen.getByRole('button', { name: p.confirmStart }))
    expect(screen.getByText(p.futureDay)).toBeInTheDocument()
    expect(startPlannedWorkout).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '2026-10-20' } })
    await user.click(screen.getByRole('button', { name: p.confirmStart }))
    expect(startPlannedWorkout).toHaveBeenCalledWith('s1', '2026-10-20', expect.any(String))
    expect(await screen.findByText('PANTALLA DE SESION')).toBeInTheDocument()
  })

  it('una planificada de hoy se empieza con un gesto, sin cambiar de fecha', async () => {
    vi.mocked(fetchSessionsOfDay).mockResolvedValue([summary({ session_date: '2026-10-22' })])
    vi.mocked(startPlannedWorkout).mockResolvedValue({
      id: 's1',
      session_date: '2026-10-22',
      status: 'in_progress',
      revision: 1,
    })
    renderDay('2026-10-22')
    await userEvent.setup().click(await screen.findByRole('button', { name: p.start }))
    expect(startPlannedWorkout).toHaveBeenCalledWith('s1', null, expect.any(String))
  })

  it('la rutina de una planificada se cambia o se quita desde la sesión', async () => {
    vi.mocked(setWorkoutRoutine).mockResolvedValue('s1')
    const { PlannedActions } = await import('../../src/features/training/PlannedActions')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PlannedActions session={summary({})} withRoutineChange />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: p.changeRoutine }))
    await user.click(await screen.findByRole('button', { name: p.useRoutine('Pierna A') }))
    expect(setWorkoutRoutine).toHaveBeenCalledWith('s1', 'r2')
    expect(await screen.findByText(p.routineChanged)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: p.changeRoutine }))
    await user.click(await screen.findByRole('button', { name: p.removeRoutine }))
    expect(setWorkoutRoutine).toHaveBeenLastCalledWith('s1', null)
  })
})
