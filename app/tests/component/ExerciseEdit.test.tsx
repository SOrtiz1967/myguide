// T055 (spec 005, FR-025, FR-027, FR-028, FR-037): editar y eliminar ejercicios propios.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import {
  deleteExercise,
  fetchExercise,
  searchExercises,
  updateExercise,
  type Exercise,
} from '../../src/features/exercises/api'
import { ExerciseDetailPage } from '../../src/features/exercises/ExerciseDetailPage'
import { ExerciseEditPage } from '../../src/features/exercises/ExerciseEditPage'
import { draftKey } from '../../src/lib/drafts'

vi.mock('../../src/features/exercises/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/exercises/api')>()),
  fetchExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
  copyExercise: vi.fn(),
  searchExercises: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchExercise)
const mockedUpdate = vi.mocked(updateExercise)
const mockedDelete = vi.mocked(deleteExercise)
const mockedSearch = vi.mocked(searchExercises)
const t = es.exercises
const f = t.form

function ownExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'o1',
    origin: 'own',
    source_item_id: null,
    imported_at: null,
    based_on_exercise_id: null,
    name: 'Mi plancha',
    name_status: 'original',
    original_name: null,
    aliases: ['Tabla'],
    measurement_type: 'duration',
    primary_muscles: ['abdominals'],
    secondary_muscles: ['shoulders'],
    equipment: 'body only',
    description: '1. Apoya los codos.\n2. Aguanta.',
    description_status: 'original',
    source: null,
    based_on: null,
    ...overrides,
  }
}

const signedIn: AuthState = {
  status: 'signedIn',
  session: { user: { id: 'u1' } } as AuthState['session'],
  expired: false,
  signOut: vi.fn(),
}

function renderApp(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/ejercicios" element={<h1>Búsqueda</h1>} />
            <Route path="/ejercicios/:id" element={<ExerciseDetailPage />} />
            <Route path="/ejercicios/:id/editar" element={<ExerciseEditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

const save = () => screen.getByRole('button', { name: t.actions.save })

beforeEach(() => {
  localStorage.clear()
  mockedFetch.mockReset().mockResolvedValue(ownExercise())
  mockedUpdate.mockReset().mockResolvedValue('o1')
  mockedDelete.mockReset().mockResolvedValue(undefined)
  mockedSearch.mockReset().mockResolvedValue([])
})

describe('ExerciseEditPage', () => {
  it('el formulario viene cargado con los datos guardados', async () => {
    renderApp('/ejercicios/o1/editar')
    expect(await screen.findByDisplayValue('Mi plancha')).toBeVisible()
    expect(screen.getByRole('heading', { name: f.editTitle })).toBeVisible()
    const primary = within(screen.getByRole('group', { name: f.primaryLegend }))
    expect(primary.getByLabelText('Abdominales')).toBeChecked()
    const secondary = within(screen.getByRole('group', { name: f.secondaryLegend }))
    expect(secondary.getByLabelText('Hombros')).toBeChecked()
    expect(screen.getByLabelText(f.description, { exact: false })).toHaveValue(
      '1. Apoya los codos.\n2. Aguanta.',
    )
    expect(screen.getByLabelText(f.aliases, { exact: false })).toHaveValue('Tabla')
    expect(screen.getByLabelText(f.equipment, { exact: false })).toHaveValue('body only')
  })

  it('guarda los cambios, confirma y vuelve al detalle', async () => {
    renderApp('/ejercicios/o1/editar')
    const name = await screen.findByDisplayValue('Mi plancha')
    await userEvent.clear(name)
    await userEvent.type(name, 'Plancha larga')
    await userEvent.click(save())

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1))
    const [id, payload] = mockedUpdate.mock.calls[0]!
    expect(id).toBe('o1')
    expect(payload).toMatchObject({
      name: 'Plancha larga',
      measurement_type: 'duration',
      primary_muscles: ['abdominals'],
      aliases: ['Tabla'],
    })
    expect(await screen.findByText(f.saved)).toBeVisible()
  })

  it('rechaza los mismos valores inválidos que al crear', async () => {
    renderApp('/ejercicios/o1/editar')
    const name = await screen.findByDisplayValue('Mi plancha')
    await userEvent.clear(name)
    await userEvent.click(save())
    expect(await screen.findByText(es.exercises.errors.nameRequired)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('un campo opcional que faltaba sigue pudiendo quedar vacío', async () => {
    mockedFetch.mockResolvedValue(
      ownExercise({ description: null, description_status: null, equipment: null, aliases: [] }),
    )
    renderApp('/ejercicios/o1/editar')
    await screen.findByDisplayValue('Mi plancha')
    await userEvent.click(save())
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1))
    expect(mockedUpdate.mock.calls[0]![1]).toMatchObject({ description: null, equipment: null })
  })

  it('FR-037: un fallo de red conserva el borrador y no da por guardado', async () => {
    mockedUpdate.mockRejectedValue(new TypeError('Failed to fetch'))
    renderApp('/ejercicios/o1/editar')
    const name = await screen.findByDisplayValue('Mi plancha')
    await userEvent.clear(name)
    await userEvent.type(name, 'Cambio sin guardar')
    await userEvent.click(save())

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.queryByText(f.saved)).toBeNull()
    expect(screen.getByDisplayValue('Cambio sin guardar')).toBeVisible()
    expect(localStorage.getItem(draftKey('u1', 'exercise-edit-o1'))).toContain('Cambio sin guardar')
  })

  it('FR-028: un ejercicio del catálogo no se puede editar', async () => {
    mockedFetch.mockResolvedValue(
      ownExercise({
        id: 'c1',
        origin: 'imported',
        source_item_id: 'X',
        imported_at: '2026-10-21T12:00:00Z',
        source: { id: 's', slug: 'free-exercise-db', name: 'free-exercise-db' },
      }),
    )
    renderApp('/ejercicios/c1/editar')
    expect(await screen.findByText(f.editNotAllowed)).toBeVisible()
    expect(screen.queryByRole('button', { name: t.actions.save })).toBeNull()
  })

  it('un ejercicio inexistente o ajeno dice «No encontramos este ejercicio»', async () => {
    mockedFetch.mockResolvedValue(null)
    renderApp('/ejercicios/otro/editar')
    expect(await screen.findByText(t.notFound)).toBeVisible()
  })

  it('tras crear una copia avisa que ya se puede editar', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(
      <AuthContext.Provider value={signedIn}>
        <QueryClientProvider client={client}>
          <MemoryRouter
            initialEntries={[{ pathname: '/ejercicios/o1/editar', state: { copied: true } }]}
          >
            <Routes>
              <Route path="/ejercicios/:id/editar" element={<ExerciseEditPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    )
    expect(await screen.findByText(f.copyCreated)).toBeVisible()
  })
})

describe('Eliminar (FR-027)', () => {
  async function openDialog() {
    renderApp('/ejercicios/o1')
    const trigger = await screen.findByRole('button', { name: t.actions.delete })
    await userEvent.click(trigger)
    return trigger
  }

  it('pide confirmación accesible antes de eliminar y no elimina todavía', async () => {
    await openDialog()
    const dialog = await screen.findByRole('dialog', { name: f.deleteTitle })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent(f.deleteBody)
    expect(screen.getByRole('button', { name: t.actions.cancel })).toHaveFocus()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('Escape cancela, devuelve el foco y no elimina', async () => {
    const trigger = await openDialog()
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('Cancelar cierra el diálogo sin eliminar', async () => {
    await openDialog()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.cancel }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('al confirmar elimina y vuelve a la búsqueda', async () => {
    await openDialog()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.confirmDelete }))
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('o1'))
    expect(await screen.findByRole('heading', { name: 'Búsqueda' })).toBeVisible()
  })

  it('si falla, avisa dentro del diálogo y no lo cierra', async () => {
    mockedDelete.mockRejectedValue(new TypeError('Failed to fetch'))
    await openDialog()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.confirmDelete }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('FR-028: el catálogo no ofrece Editar ni Eliminar', async () => {
    mockedFetch.mockResolvedValue(
      ownExercise({
        id: 'c1',
        origin: 'imported',
        source_item_id: 'X',
        imported_at: '2026-10-21T12:00:00Z',
        source: { id: 's', slug: 'free-exercise-db', name: 'free-exercise-db' },
      }),
    )
    renderApp('/ejercicios/c1')
    await screen.findByRole('button', { name: t.actions.createMine })
    expect(screen.queryByRole('button', { name: t.actions.delete })).toBeNull()
    expect(screen.queryByRole('link', { name: t.actions.edit })).toBeNull()
  })
})
