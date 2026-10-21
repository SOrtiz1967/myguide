// T033 (spec 006, FR-001 a FR-004, FR-045, FR-047; escenarios 10 a 12, 16 y 17): el formulario de una rutina.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { searchExercises, type ExerciseSummary } from '../../src/features/exercises/api'
import {
  createRoutine,
  fetchRoutine,
  updateRoutine,
  type Routine,
} from '../../src/features/training/api'
import { RoutineFormPage } from '../../src/features/training/RoutineFormPage'
import { draftKey } from '../../src/lib/drafts'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/exercises/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/exercises/api')>()),
  searchExercises: vi.fn(),
  catalogHasExercises: vi.fn().mockResolvedValue(true),
}))
vi.mock('../../src/features/training/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/training/api')>()),
  createRoutine: vi.fn(),
  updateRoutine: vi.fn(),
  fetchRoutine: vi.fn(),
}))

const mockedSearch = vi.mocked(searchExercises)
const mockedCreate = vi.mocked(createRoutine)
const mockedUpdate = vi.mocked(updateRoutine)
const mockedFetch = vi.mocked(fetchRoutine)
const r = es.training.routines
const v = es.training.validation
const re = es.training.errors.routine
const e = es.training.editor

const signedIn: AuthState = {
  status: 'signedIn',
  session: { user: { id: 'u1' } } as AuthState['session'],
  expired: false,
  signOut: vi.fn(),
}

function summary(over: Partial<ExerciseSummary> = {}): ExerciseSummary {
  return {
    id: 'e1',
    name: 'Press de banca',
    name_status: 'original',
    measurement_type: 'reps_weight',
    primary_muscles: ['chest'],
    equipment: 'barbell',
    origin: 'imported',
    based_on_exercise_id: null,
    source_name: 'free-exercise-db',
    total_estimate: 1,
    ...over,
  }
}

function routineFixture(over: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    name: 'Torso A',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    routine_exercises: [
      {
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
      },
    ],
    ...over,
  }
}

function renderPage(entry = '/entrenamiento/rutinas/nueva') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/entrenamiento/rutinas/nueva" element={<RoutineFormPage />} />
            <Route path="/entrenamiento/rutinas/:id/editar" element={<RoutineFormPage />} />
            <Route path="/entrenamiento/rutinas/:id" element={<h1>Detalle de la rutina</h1>} />
            <Route path="/entrenamiento/rutinas" element={<h1>Lista de rutinas</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

const nameField = () => screen.getByLabelText(r.name)
const save = () => screen.getByRole('button', { name: r.save })
const item = (name: string) => within(screen.getByRole('article', { name }))

async function addExercise(searchText: string, exercise: ExerciseSummary) {
  mockedSearch.mockResolvedValue([exercise])
  await userEvent.click(screen.getByRole('button', { name: r.addExercise }))
  const dialog = await screen.findByRole('dialog', { name: es.training.picker.title })
  await userEvent.type(within(dialog).getByLabelText(es.training.picker.searchLabel), searchText)
  await userEvent.click(
    await within(dialog).findByRole('button', { name: new RegExp(exercise.name) }),
  )
}

beforeEach(() => {
  localStorage.clear()
  mockedSearch.mockReset().mockResolvedValue([])
  mockedCreate.mockReset().mockResolvedValue('creada')
  mockedUpdate.mockReset().mockResolvedValue('r1')
  mockedFetch.mockReset().mockResolvedValue(routineFixture())
})

describe('alta de una rutina', () => {
  it('sin nombre ni ejercicios no se guarda y dice qué falta', async () => {
    renderPage()
    await userEvent.click(save())
    expect(await screen.findByText(re.name_required)).toBeVisible()
    expect(screen.getByText(re.exercises_required)).toBeVisible()
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('agregar ejercicios muestra los objetivos que corresponden a su tipo (escenario 11)', async () => {
    renderPage()
    await addExercise('press', summary())
    const press = item('Press de banca')
    expect(press.getByLabelText(r.targetReps)).toBeVisible()
    expect(press.getByLabelText(r.targetWeight)).toBeVisible()
    expect(press.queryByLabelText(r.targetDuration)).toBeNull()
    expect(press.getByLabelText(r.sets)).toHaveValue('3')

    await addExercise(
      'plancha',
      summary({ id: 'e2', name: 'Plancha', measurement_type: 'duration' }),
    )
    const plancha = item('Plancha')
    expect(plancha.getByLabelText(r.targetDuration)).toBeVisible()
    expect(plancha.queryByLabelText(r.targetReps)).toBeNull()

    await addExercise(
      'correr',
      summary({ id: 'e3', name: 'Correr', measurement_type: 'distance_duration' }),
    )
    const correr = item('Correr')
    expect(correr.getByLabelText(r.targetDistance)).toBeVisible()
    expect(correr.getByLabelText(r.targetDuration)).toBeVisible()
  })

  it('valida las series y los objetivos al escribir (escenario 12)', async () => {
    renderPage()
    await userEvent.type(nameField(), 'Torso A')
    await addExercise('press', summary())
    const press = item('Press de banca')
    await userEvent.clear(press.getByLabelText(r.sets))
    await userEvent.type(press.getByLabelText(r.sets), '21')
    await userEvent.type(press.getByLabelText(r.targetReps), '0')
    await userEvent.click(save())
    expect(await screen.findByText(re.invalid_sets)).toBeVisible()
    expect(screen.getByText(v.reps)).toBeVisible()
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('un peso objetivo de 0 es válido', async () => {
    renderPage()
    await userEvent.type(nameField(), 'Torso A')
    await addExercise('press', summary())
    await userEvent.type(item('Press de banca').getByLabelText(r.targetWeight), '0')
    await userEvent.click(save())
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1))
    expect(mockedCreate.mock.calls[0]![0].exercises[0]).toMatchObject({ target_weight_kg: 0 })
  })

  it('reordenar y quitar ejercicios', async () => {
    renderPage()
    await addExercise('press', summary())
    await addExercise(
      'plancha',
      summary({ id: 'e2', name: 'Plancha', measurement_type: 'duration' }),
    )
    await userEvent.click(screen.getByRole('button', { name: e.moveExerciseUp('Plancha') }))
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'Plancha',
      'Press de banca',
    ])
    await userEvent.click(screen.getByRole('button', { name: e.removeExercise('Plancha') }))
    expect(screen.queryByRole('article', { name: 'Plancha' })).toBeNull()
  })

  it('guarda con el payload del servidor y lleva al detalle (escenario 10)', async () => {
    renderPage()
    await userEvent.type(nameField(), '  Torso A  ')
    await addExercise('press', summary())
    const press = item('Press de banca')
    await userEvent.clear(press.getByLabelText(r.sets))
    await userEvent.type(press.getByLabelText(r.sets), '4')
    await userEvent.type(press.getByLabelText(r.targetReps), '8')
    await userEvent.type(press.getByLabelText(r.targetWeight), '62,5')
    await userEvent.click(save())
    expect(await screen.findByRole('heading', { name: 'Detalle de la rutina' })).toBeVisible()
    const [payload, requestId] = mockedCreate.mock.calls[0]!
    expect(payload).toEqual({
      name: 'Torso A',
      exercises: [
        {
          exercise_id: 'e1',
          sets: 4,
          target_reps: 8,
          target_weight_kg: 62.5,
          target_duration_s: null,
          target_distance_km: null,
        },
      ],
    })
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem(draftKey('u1', 'routine-new'))).toBeNull()
  })

  it('el doble clic crea una sola rutina (escenario 17)', async () => {
    let resolve: (id: string) => void = () => {}
    mockedCreate.mockImplementation(() => new Promise((res) => (resolve = res)))
    renderPage()
    await userEvent.type(nameField(), 'Torso A')
    await addExercise('press', summary())
    await userEvent.dblClick(save())
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    resolve('creada')
    expect(await screen.findByRole('heading', { name: 'Detalle de la rutina' })).toBeVisible()
  })

  it('un fallo de red avisa, no da por guardado y conserva lo escrito y el borrador', async () => {
    mockedCreate.mockRejectedValue(new WriteError(true, es.errors.offline))
    renderPage()
    await userEvent.type(nameField(), 'Torso A')
    await addExercise('press', summary())
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.queryByRole('heading', { name: 'Detalle de la rutina' })).toBeNull()
    expect(nameField()).toHaveValue('Torso A')
    expect(localStorage.getItem(draftKey('u1', 'routine-new'))).toContain('Torso A')
  })

  it('recupera el borrador al volver y se puede descartar (FR-045)', async () => {
    const first = renderPage()
    await userEvent.type(nameField(), 'A medias')
    first.unmount()
    renderPage()
    expect(await screen.findByText(r.draftRestored)).toBeVisible()
    expect(nameField()).toHaveValue('A medias')
    await userEvent.click(screen.getByRole('button', { name: r.draftDiscard }))
    expect(nameField()).toHaveValue('')
  })
})

describe('edición de una rutina', () => {
  it('viene cargada con lo guardado y guarda los cambios', async () => {
    renderPage('/entrenamiento/rutinas/r1/editar')
    expect(await screen.findByDisplayValue('Torso A')).toBeVisible()
    const press = item('Press de banca')
    expect(press.getByLabelText(r.sets)).toHaveValue('4')
    expect(press.getByLabelText(r.targetReps)).toHaveValue('8')
    expect(press.getByLabelText(r.targetWeight)).toHaveValue('60')
    await userEvent.clear(nameField())
    await userEvent.type(nameField(), 'Torso B')
    await userEvent.click(screen.getByRole('button', { name: r.save }))
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1))
    expect(mockedUpdate.mock.calls[0]![0]).toBe('r1')
    expect(mockedUpdate.mock.calls[0]![1]).toMatchObject({ name: 'Torso B' })
    expect(await screen.findByRole('heading', { name: 'Detalle de la rutina' })).toBeVisible()
  })

  it('un ejercicio que ya no existe se avisa, conserva su nombre y se puede reemplazar (escenario 16)', async () => {
    mockedFetch.mockResolvedValue(
      routineFixture({
        routine_exercises: [
          { ...routineFixture().routine_exercises[0]!, exercise_id: null, exercise: null },
        ],
      }),
    )
    renderPage('/entrenamiento/rutinas/r1/editar')
    await screen.findByRole('article', { name: 'Press de banca' })
    const press = item('Press de banca')
    expect(await press.findByText(r.missingExercise)).toBeVisible()
    // no se puede guardar así: el servidor lo rechazaría
    await userEvent.click(save())
    expect(await screen.findByText(re.exercise_not_found)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()

    mockedSearch.mockResolvedValue([summary({ id: 'e9', name: 'Press con mancuernas' })])
    await userEvent.click(press.getByRole('button', { name: r.replace }))
    const dialog = await screen.findByRole('dialog', { name: es.training.picker.title })
    await userEvent.type(within(dialog).getByLabelText(es.training.picker.searchLabel), 'press')
    await userEvent.click(
      await within(dialog).findByRole('button', { name: /Press con mancuernas/ }),
    )
    expect(screen.getByRole('article', { name: 'Press con mancuernas' })).toBeVisible()
    expect(screen.queryByText(r.missingExercise)).toBeNull()
    await userEvent.click(save())
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1))
    expect(mockedUpdate.mock.calls[0]![1].exercises[0]).toMatchObject({
      exercise_id: 'e9',
      sets: 4,
    })
  })

  it('si cambió el tipo de medición de un ejercicio, avisa y muestra los objetivos de antes', async () => {
    mockedFetch.mockResolvedValue(
      routineFixture({
        routine_exercises: [
          {
            ...routineFixture().routine_exercises[0]!,
            exercise: { id: 'e1', name: 'Press de banca', measurement_type: 'duration' },
          },
        ],
      }),
    )
    renderPage('/entrenamiento/rutinas/r1/editar')
    await screen.findByRole('article', { name: 'Press de banca' })
    const press = item('Press de banca')
    expect(
      await press.findByText(/El tipo de medición de este ejercicio cambió/),
    ).toHaveTextContent('8 repeticiones')
    // ahora pide los objetivos del tipo nuevo (tiempo), vacíos
    expect(press.getByLabelText(r.targetDuration)).toHaveValue('')
    expect(press.queryByLabelText(r.targetReps)).toBeNull()
  })

  it('una rutina inexistente o ajena dice que no la encontró', async () => {
    mockedFetch.mockResolvedValue(null)
    renderPage('/entrenamiento/rutinas/otra/editar')
    expect(await screen.findByText(es.training.errors.notFound)).toBeVisible()
  })
})
