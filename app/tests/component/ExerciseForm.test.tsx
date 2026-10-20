// T030 (spec 005, FR-022, FR-024, FR-025, FR-029, FR-037): formulario de un ejercicio propio.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { createExercise, searchExercises } from '../../src/features/exercises/api'
import { ExerciseCreatePage } from '../../src/features/exercises/ExerciseCreatePage'
import { draftKey } from '../../src/lib/drafts'

vi.mock('../../src/features/exercises/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/exercises/api')>()),
  createExercise: vi.fn(),
  searchExercises: vi.fn(),
}))

const mockedCreate = vi.mocked(createExercise)
const mockedSearch = vi.mocked(searchExercises)
const t = es.exercises
const f = t.form

const signedIn: AuthState = {
  status: 'signedIn',
  session: { user: { id: 'u1' } } as AuthState['session'],
  expired: false,
  signOut: vi.fn(),
}

function DetailStub() {
  const location = useLocation()
  const saved = (location.state as { saved?: boolean } | null)?.saved
  return (
    <div>
      <h1>Detalle {location.pathname}</h1>
      {saved ? <p role="status">{f.saved}</p> : null}
    </div>
  )
}

function renderPage(entry = '/ejercicios/nuevo') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/ejercicios/nuevo" element={<ExerciseCreatePage />} />
            <Route path="/ejercicios/:id" element={<DetailStub />} />
            <Route path="/ejercicios" element={<h1>Búsqueda</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

const nameField = () => screen.getByLabelText(f.name)
const save = () => screen.getByRole('button', { name: t.actions.save })
const measurement = (label: string) => screen.getByRole('radio', { name: new RegExp(label) })
const musclesGroup = (legend: string) => screen.getByRole('group', { name: legend })

beforeEach(() => {
  mockedCreate.mockReset().mockResolvedValue('new-id')
  mockedSearch.mockReset().mockResolvedValue([])
})

describe('crear con lo obligatorio y completo (escenarios 15 y 16)', () => {
  it('con solo nombre y tipo de medición envía el resto vacío y vuelve al detalle', async () => {
    renderPage()
    await userEvent.type(nameField(), 'Plancha lateral')
    await userEvent.click(measurement('Tiempo'))
    await userEvent.click(save())

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1))
    const [payload, requestId] = mockedCreate.mock.calls[0]!
    expect(payload).toEqual({
      name: 'Plancha lateral',
      measurement_type: 'duration',
      primary_muscles: [],
      secondary_muscles: [],
      equipment: null,
      description: null,
      aliases: [],
    })
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByRole('heading', { name: 'Detalle /ejercicios/new-id' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(f.saved)
  })

  it('completo: músculos, equipamiento, descripción y otros nombres', async () => {
    renderPage()
    await userEvent.type(nameField(), 'Remo con banda')
    await userEvent.click(measurement('Repeticiones y peso'))
    await userEvent.click(
      within(musclesGroup(f.primaryLegend)).getByRole('checkbox', { name: 'Dorsales' }),
    )
    await userEvent.click(
      within(musclesGroup(f.primaryLegend)).getByRole('checkbox', { name: 'Espalda media' }),
    )
    await userEvent.click(
      within(musclesGroup(f.secondaryLegend)).getByRole('checkbox', { name: 'Bíceps' }),
    )
    await userEvent.selectOptions(screen.getByLabelText(f.equipment), 'bands')
    await userEvent.type(
      screen.getByLabelText(f.description, { exact: false }),
      '1. Sujeta la banda.{enter}2. Tira.',
    )
    await userEvent.type(
      screen.getByLabelText(f.aliases, { exact: false }),
      'Remo elástico, Remo con goma',
    )
    await userEvent.click(save())

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1))
    expect(mockedCreate.mock.calls[0]![0]).toEqual({
      name: 'Remo con banda',
      measurement_type: 'reps_weight',
      primary_muscles: ['lats', 'middle back'],
      secondary_muscles: ['biceps'],
      equipment: 'bands',
      description: '1. Sujeta la banda.\n2. Tira.',
      aliases: ['Remo elástico', 'Remo con goma'],
    })
  })

  it('`?nombre=` precarga el nombre que se buscó', () => {
    renderPage('/ejercicios/nuevo?nombre=Natación%20libre')
    expect(nameField()).toHaveValue('Natación libre')
  })
})

describe('estructura accesible (FR-024)', () => {
  it('el tipo de medición son botones de radio, cada uno con su explicación', () => {
    renderPage()
    const group = screen.getByRole('group', { name: f.measurementLegend })
    expect(within(group).getAllByRole('radio')).toHaveLength(4)
    expect(within(group).getByText('Se registra con repeticiones y peso')).toBeVisible()
    expect(within(group).getByText('Se registra con distancia y tiempo')).toBeVisible()
  })

  it('los músculos son casillas en grupos con leyenda: 18 principales y 18 secundarios, en español', () => {
    renderPage()
    expect(within(musclesGroup(f.primaryLegend)).getAllByRole('checkbox')).toHaveLength(18)
    expect(within(musclesGroup(f.secondaryLegend)).getAllByRole('checkbox')).toHaveLength(18)
    expect(
      within(musclesGroup(f.primaryLegend)).getByRole('checkbox', { name: 'Cuerpo completo' }),
    ).toBeVisible()
  })

  it('el equipamiento es una lista con «Sin dato» y los 12 valores', () => {
    renderPage()
    const options = within(screen.getByLabelText(f.equipment)).getAllByRole('option')
    expect(options).toHaveLength(13)
    expect(options[0]).toHaveTextContent(f.equipmentNone)
  })
})

describe('validación (escenario 17)', () => {
  it('sin nombre ni tipo muestra cada mensaje en su campo y no envía nada', async () => {
    renderPage()
    await userEvent.click(save())
    expect(await screen.findByText(t.errors.nameRequired)).toBeVisible()
    expect(screen.getByText(t.errors.measurementRequired)).toBeVisible()
    expect(nameField()).toBeInvalid()
    expect(nameField()).toHaveFocus() // el foco va al primer error
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('una descripción de más de 4.000 caracteres se rechaza', async () => {
    renderPage()
    await userEvent.type(nameField(), 'Algo')
    await userEvent.click(measurement('Tiempo'))
    const description = screen.getByLabelText(f.description, { exact: false })
    await userEvent.click(description)
    await userEvent.paste('a'.repeat(4001))
    await userEvent.click(save())
    expect(await screen.findByText(t.errors.descriptionTooLong)).toBeVisible()
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('un músculo principal y secundario a la vez se rechaza', async () => {
    renderPage()
    await userEvent.type(nameField(), 'Algo')
    await userEvent.click(measurement('Tiempo'))
    await userEvent.click(
      within(musclesGroup(f.primaryLegend)).getByRole('checkbox', { name: 'Pecho' }),
    )
    await userEvent.click(
      within(musclesGroup(f.secondaryLegend)).getByRole('checkbox', { name: 'Pecho' }),
    )
    await userEvent.click(save())
    expect(await screen.findByText(t.errors.muscleRepeated)).toBeVisible()
    expect(mockedCreate).not.toHaveBeenCalled()
  })
})

describe('nombre repetido entre los propios (escenario 18)', () => {
  const own = (name: string, id = 'o1') => ({
    id,
    name,
    name_status: 'original' as const,
    measurement_type: 'duration' as const,
    primary_muscles: [],
    equipment: null,
    origin: 'own' as const,
    based_on_exercise_id: null,
    source_name: null,
    total_estimate: 1,
  })

  it('avisa sin impedir guardar, comparando sin acentos ni mayúsculas', async () => {
    mockedSearch.mockResolvedValue([own('Elevación Lateral')])
    renderPage()
    await userEvent.type(nameField(), 'elevacion lateral')
    expect(await screen.findByText(f.duplicateName)).toBeVisible()
    expect(mockedSearch).toHaveBeenCalledWith(expect.objectContaining({ scope: 'own' }))

    await userEvent.click(measurement('Repeticiones y peso'))
    await userEvent.click(save())
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1))
  })

  it('no avisa si lo encontrado solo se parece', async () => {
    mockedSearch.mockResolvedValue([own('Elevación lateral con mancuernas')])
    renderPage()
    await userEvent.type(nameField(), 'Elevación lateral')
    await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
    expect(screen.queryByText(f.duplicateName)).not.toBeInTheDocument()
  })
})

describe('guardado confiable (escenarios 19 a 21)', () => {
  async function fillRequired() {
    await userEvent.type(nameField(), 'Plancha')
    await userEvent.click(measurement('Tiempo'))
  }

  it('un doble clic envía una sola solicitud', async () => {
    mockedCreate.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('new-id'), 30)),
    )
    renderPage()
    await fillRequired()
    await userEvent.dblClick(save())
    await screen.findByRole('heading', { name: 'Detalle /ejercicios/new-id' })
    expect(mockedCreate).toHaveBeenCalledTimes(1)
  })

  it('si no llegó al servidor lo dice, conserva lo escrito y el reintento usa la misma solicitud', async () => {
    mockedCreate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderPage()
    await fillRequired()
    await userEvent.click(save())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(f.notSaved)
    expect(alert).toHaveTextContent(es.errors.offline)
    expect(nameField()).toHaveValue('Plancha')
    expect(measurement('Tiempo')).toBeChecked()
    expect(screen.queryByRole('heading', { name: /Detalle/ })).not.toBeInTheDocument()

    await userEvent.click(save())
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2))
    expect(mockedCreate.mock.calls[1]![1]).toBe(mockedCreate.mock.calls[0]![1])
    expect(await screen.findByRole('heading', { name: /Detalle/ })).toBeVisible()
  })

  it('con la sesión vencida avisa y conserva el borrador', async () => {
    mockedCreate.mockRejectedValueOnce({ message: 'session_expired: la sesion vencio' })
    renderPage()
    await fillRequired()
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.sessionExpired)
    await waitFor(() => expect(localStorage.getItem(draftKey('u1', 'exercise-new'))).not.toBeNull())
  })

  it('el borrador vuelve al reabrir con un aviso, y se borra al guardar', async () => {
    const first = renderPage()
    await userEvent.type(nameField(), 'Mi borrador')
    await waitFor(() => expect(localStorage.getItem(draftKey('u1', 'exercise-new'))).not.toBeNull())
    first.unmount()

    renderPage()
    expect(nameField()).toHaveValue('Mi borrador')
    expect(screen.getByText(f.draftRestored)).toBeVisible()
    await userEvent.click(measurement('Tiempo'))
    await userEvent.click(save())
    await screen.findByRole('heading', { name: /Detalle/ })
    expect(localStorage.getItem(draftKey('u1', 'exercise-new'))).toBeNull()
  })

  it('«Descartar borrador» limpia el formulario', async () => {
    localStorage.setItem(
      draftKey('u1', 'exercise-new'),
      JSON.stringify({
        savedAt: Date.now(),
        values: {
          name: 'Viejo',
          measurement_type: 'duration',
          primary_muscles: [],
          secondary_muscles: [],
          equipment: '',
          description: '',
          aliases: '',
        },
      }),
    )
    renderPage()
    expect(nameField()).toHaveValue('Viejo')
    await userEvent.click(screen.getByRole('button', { name: f.draftDiscard }))
    expect(nameField()).toHaveValue('')
    expect(localStorage.getItem(draftKey('u1', 'exercise-new'))).toBeNull()
  })
})
