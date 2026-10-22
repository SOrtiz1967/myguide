// T045 (spec 006, FR-027a; escenarios 18 y 29): empezar a entrenar con una rutina, con un solo gesto.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  fetchRoutines,
  SessionInProgressError,
  startWorkoutFromRoutine,
  type Routine,
} from '../../src/features/training/api'
import { RoutinePicker } from '../../src/features/training/RoutinePicker'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchRoutines: vi.fn(),
  startWorkoutFromRoutine: vi.fn(),
}))

const mockedList = vi.mocked(fetchRoutines)
const mockedStart = vi.mocked(startWorkoutFromRoutine)
const h = es.training.home

function routine(id: string, name: string, count: number): Routine {
  return {
    id,
    name,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    routine_exercises: Array.from({ length: count }, (_, i) => ({
      id: `${id}-${i}`,
      routine_id: id,
      position: i + 1,
      exercise_id: `e${i}`,
      exercise_name: `Ejercicio ${i}`,
      measurement_type: 'reps_weight' as const,
      sets: 3,
      target_reps: null,
      target_weight_kg: null,
      target_duration_s: null,
      target_distance_km: null,
      exercise: null,
    })),
  }
}

function renderPicker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/entrenamiento']}>
        <Routes>
          <Route path="/entrenamiento" element={<RoutinePicker />} />
          <Route path="/entrenamiento/sesion/:id" element={<h1>Sesión abierta</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedList
    .mockReset()
    .mockResolvedValue([routine('r1', 'Torso A', 3), routine('r2', 'Pierna', 1)])
  mockedStart.mockReset().mockResolvedValue({
    id: 'nueva',
    session_date: '2026-10-22',
    status: 'in_progress',
    revision: 1,
  })
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('RoutinePicker', () => {
  it('lista las rutinas del catálogo con la cantidad de ejercicios', async () => {
    renderPicker()
    const torso = await screen.findByRole('button', { name: new RegExp(h.startWith('Torso A')) })
    expect(torso).toHaveTextContent(es.training.routines.exerciseCount(3))
    expect(screen.getByRole('button', { name: new RegExp(h.startWith('Pierna')) })).toBeVisible()
  })

  it('elegir una rutina empieza la sesión con su plan y la abre, con un solo gesto', async () => {
    renderPicker()
    await userEvent.click(
      await screen.findByRole('button', { name: new RegExp(h.startWith('Torso A')) }),
    )
    expect(await screen.findByRole('heading', { name: 'Sesión abierta' })).toBeVisible()
    expect(mockedStart).toHaveBeenCalledTimes(1)
    const [id, date, requestId] = mockedStart.mock.calls[0]!
    expect(id).toBe('r1')
    expect(date).toBeNull()
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('el doble clic crea una sola sesión', async () => {
    let resolve: (value: Awaited<ReturnType<typeof startWorkoutFromRoutine>>) => void = () => {}
    mockedStart.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderPicker()
    await userEvent.dblClick(
      await screen.findByRole('button', { name: new RegExp(h.startWith('Torso A')) }),
    )
    expect(mockedStart).toHaveBeenCalledTimes(1)
    resolve({ id: 'nueva', session_date: '2026-10-22', status: 'in_progress', revision: 1 })
    expect(await screen.findByRole('heading', { name: 'Sesión abierta' })).toBeVisible()
  })

  it('sin rutinas invita a armar una', async () => {
    mockedList.mockResolvedValue([])
    renderPicker()
    expect(await screen.findByText(h.noRoutines)).toBeVisible()
    expect(screen.getByRole('link', { name: h.createRoutine })).toHaveAttribute(
      'href',
      '/entrenamiento/rutinas/nueva',
    )
  })

  it('si ya hay una sesión abierta, ofrece continuarla', async () => {
    mockedStart.mockRejectedValue(new SessionInProgressError('abierta'))
    renderPicker()
    await userEvent.click(
      await screen.findByRole('button', { name: new RegExp(h.startWith('Torso A')) }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(es.training.errors.sessionInProgress)
    expect(screen.getByRole('link', { name: h.continue })).toHaveAttribute(
      'href',
      '/entrenamiento/sesion/abierta',
    )
  })

  it('si falla, avisa que no se creó nada y reintenta con el mismo identificador', async () => {
    mockedStart.mockRejectedValueOnce(new WriteError(true, es.errors.offline)).mockResolvedValue({
      id: 'nueva',
      session_date: '2026-10-22',
      status: 'in_progress',
      revision: 1,
    })
    renderPicker()
    await userEvent.click(
      await screen.findByRole('button', { name: new RegExp(h.startWith('Torso A')) }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    await userEvent.click(screen.getByRole('button', { name: new RegExp(h.startWith('Torso A')) }))
    expect(await screen.findByRole('heading', { name: 'Sesión abierta' })).toBeVisible()
    expect(mockedStart.mock.calls[0]![2]).toBe(mockedStart.mock.calls[1]![2])
  })

  it('muestra la carga y, si falla la lista, permite reintentar', async () => {
    mockedList
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue([routine('r1', 'Torso A', 3)])
    renderPicker()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.training.routines.loadError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(
      await screen.findByRole('button', { name: new RegExp(h.startWith('Torso A')) }),
    ).toBeVisible()
  })
})
