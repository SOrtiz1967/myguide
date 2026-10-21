// T034 (spec 006, FR-003, FR-004, FR-005, FR-006; escenarios 13 a 16): lista y detalle de rutinas.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  deleteRoutine,
  duplicateRoutine,
  fetchRoutine,
  fetchRoutines,
  type Routine,
  type RoutineExercise,
} from '../../src/features/training/api'
import { RoutineDetailPage } from '../../src/features/training/RoutineDetailPage'
import { RoutinesPage } from '../../src/features/training/RoutinesPage'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  fetchRoutines: vi.fn(),
  fetchRoutine: vi.fn(),
  duplicateRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
}))

const mockedList = vi.mocked(fetchRoutines)
const mockedFetch = vi.mocked(fetchRoutine)
const mockedDuplicate = vi.mocked(duplicateRoutine)
const mockedDelete = vi.mocked(deleteRoutine)
const r = es.training.routines

function ex(over: Partial<RoutineExercise> = {}): RoutineExercise {
  return {
    id: 'i1',
    routine_id: 'r1',
    position: 1,
    exercise_id: 'e1',
    exercise_name: 'Press de banca',
    measurement_type: 'reps_weight',
    sets: 4,
    target_reps: 8,
    target_weight_kg: 60,
    target_duration_s: null,
    target_distance_km: null,
    exercise: { id: 'e1', name: 'Press de banca', measurement_type: 'reps_weight' },
    ...over,
  }
}

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    name: 'Torso A',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    routine_exercises: [ex()],
    ...over,
  }
}

function renderAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/entrenamiento/rutinas" element={<RoutinesPage />} />
          <Route path="/entrenamiento/rutinas/nueva" element={<h1>Nueva rutina</h1>} />
          <Route path="/entrenamiento/rutinas/:id" element={<RoutineDetailPage />} />
          <Route path="/entrenamiento/rutinas/:id/editar" element={<h1>Editar</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedList.mockReset().mockResolvedValue([routine()])
  mockedFetch.mockReset().mockResolvedValue(routine())
  mockedDuplicate.mockReset().mockResolvedValue('copia')
  mockedDelete.mockReset().mockResolvedValue(undefined)
})

describe('lista de rutinas (FR-006)', () => {
  it('muestra el nombre y la cantidad de ejercicios con un enlace a cada una', async () => {
    mockedList.mockResolvedValue([
      routine(),
      routine({
        id: 'r2',
        name: 'Pierna',
        routine_exercises: [ex(), ex({ id: 'i2', position: 2 })],
      }),
    ])
    renderAt('/entrenamiento/rutinas')
    const first = await screen.findByRole('link', { name: /Torso A/ })
    expect(first).toHaveAttribute('href', '/entrenamiento/rutinas/r1')
    expect(first).toHaveTextContent(r.exerciseCount(1))
    expect(screen.getByRole('link', { name: /Pierna/ })).toHaveTextContent(r.exerciseCount(2))
    expect(screen.getByRole('link', { name: r.newRoutine })).toHaveAttribute(
      'href',
      '/entrenamiento/rutinas/nueva',
    )
  })

  it('sin rutinas invita a armar una', async () => {
    mockedList.mockResolvedValue([])
    renderAt('/entrenamiento/rutinas')
    expect(await screen.findByText(r.empty)).toBeVisible()
  })

  it('muestra la carga y, si falla, avisa y permite reintentar', async () => {
    mockedList.mockReturnValueOnce(new Promise(() => {}))
    const first = renderAt('/entrenamiento/rutinas')
    expect(screen.getByRole('status')).toBeVisible()
    first.unmount()
    mockedList.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([routine()])
    renderAt('/entrenamiento/rutinas')
    expect(await screen.findByRole('alert')).toHaveTextContent(r.loadError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('link', { name: /Torso A/ })).toBeVisible()
  })
})

describe('detalle de una rutina', () => {
  it('muestra los ejercicios con sus series y objetivos, con unidades', async () => {
    mockedFetch.mockResolvedValue(
      routine({
        routine_exercises: [
          ex(),
          ex({
            id: 'i2',
            position: 2,
            exercise_id: 'e2',
            exercise_name: 'Plancha',
            measurement_type: 'duration',
            sets: 2,
            target_reps: null,
            target_weight_kg: null,
            target_duration_s: 90,
            exercise: { id: 'e2', name: 'Plancha', measurement_type: 'duration' },
          }),
          ex({
            id: 'i3',
            position: 3,
            exercise_id: 'e3',
            exercise_name: 'Flexiones',
            measurement_type: 'reps_bodyweight',
            sets: 1,
            target_reps: null,
            target_weight_kg: null,
            exercise: { id: 'e3', name: 'Flexiones', measurement_type: 'reps_bodyweight' },
          }),
        ],
      }),
    )
    renderAt('/entrenamiento/rutinas/r1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Torso A' })).toBeVisible()
    const press = within(screen.getByRole('article', { name: 'Press de banca' }))
    expect(press.getByText(r.setsOf(4))).toBeVisible()
    expect(press.getByText('8 repeticiones · 60 kg')).toBeVisible()
    expect(
      within(screen.getByRole('article', { name: 'Plancha' })).getByText('1:30 min'),
    ).toBeVisible()
    expect(
      within(screen.getByRole('article', { name: 'Flexiones' })).getByText(es.training.noData),
    ).toBeVisible()
  })

  it('avisa por ítem si el ejercicio ya no existe y sigue mostrando su nombre (escenario 16)', async () => {
    mockedFetch.mockResolvedValue(
      routine({ routine_exercises: [ex({ exercise_id: null, exercise: null })] }),
    )
    renderAt('/entrenamiento/rutinas/r1')
    const press = within(await screen.findByRole('article', { name: 'Press de banca' }))
    expect(press.getByText(r.missingExercise)).toBeVisible()
  })

  it('muestra el nombre vigente del ejercicio si cambió', async () => {
    mockedFetch.mockResolvedValue(
      routine({
        routine_exercises: [
          ex({ exercise: { id: 'e1', name: 'Press plano', measurement_type: 'reps_weight' } }),
        ],
      }),
    )
    renderAt('/entrenamiento/rutinas/r1')
    expect(await screen.findByRole('article', { name: 'Press plano' })).toBeVisible()
  })

  it('avisa por ítem si cambió el tipo de medición', async () => {
    mockedFetch.mockResolvedValue(
      routine({
        routine_exercises: [
          ex({ exercise: { id: 'e1', name: 'Press de banca', measurement_type: 'duration' } }),
        ],
      }),
    )
    renderAt('/entrenamiento/rutinas/r1')
    const press = within(await screen.findByRole('article', { name: 'Press de banca' }))
    expect(press.getByText(/El tipo de medición de este ejercicio cambió/)).toBeVisible()
  })

  it('duplicar crea una copia independiente y lleva a ella (escenario 14)', async () => {
    renderAt('/entrenamiento/rutinas/r1')
    await userEvent.click(await screen.findByRole('button', { name: r.duplicate }))
    expect(await screen.findByText(r.duplicated)).toBeVisible()
    expect(mockedDuplicate).toHaveBeenCalledWith('r1', expect.stringMatching(/^[0-9a-f-]{36}$/))
  })

  it('el enlace de editar lleva al formulario', async () => {
    renderAt('/entrenamiento/rutinas/r1')
    expect(await screen.findByRole('link', { name: r.edit })).toHaveAttribute(
      'href',
      '/entrenamiento/rutinas/r1/editar',
    )
  })

  it('una rutina inexistente o ajena dice que no la encontró', async () => {
    mockedFetch.mockResolvedValue(null)
    renderAt('/entrenamiento/rutinas/otra')
    expect(await screen.findByText(es.training.errors.notFound)).toBeVisible()
  })
})

describe('eliminar una rutina (escenario 15)', () => {
  async function openDialog() {
    renderAt('/entrenamiento/rutinas/r1')
    const trigger = await screen.findByRole('button', { name: r.delete })
    await userEvent.click(trigger)
    return trigger
  }

  it('pide confirmación accesible y aclara que las sesiones ya creadas no cambian', async () => {
    await openDialog()
    const dialog = await screen.findByRole('dialog', { name: r.confirmDeleteTitle })
    expect(dialog).toHaveTextContent(r.confirmDeleteBody)
    expect(screen.getByRole('button', { name: r.cancel })).toHaveFocus()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('Escape cancela y devuelve el foco', async () => {
    const trigger = await openDialog()
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('al confirmar elimina y vuelve a la lista con un aviso', async () => {
    mockedList.mockResolvedValue([])
    await openDialog()
    await userEvent.click(await screen.findByRole('button', { name: r.confirmDelete }))
    expect(await screen.findByText(r.deleted)).toBeVisible()
    expect(mockedDelete).toHaveBeenCalledWith('r1')
  })

  it('si falla, avisa dentro del diálogo y no lo cierra', async () => {
    mockedDelete.mockRejectedValue(new WriteError(true, es.errors.offline))
    await openDialog()
    await userEvent.click(await screen.findByRole('button', { name: r.confirmDelete }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.getByRole('dialog')).toBeVisible()
  })
})
