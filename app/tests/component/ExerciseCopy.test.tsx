// T050 (spec 005, FR-026, FR-029): crear mi versión de un ejercicio del catálogo (o una copia de uno propio).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { copyExercise, fetchExercise, type Exercise } from '../../src/features/exercises/api'
import { ExerciseDetailPage } from '../../src/features/exercises/ExerciseDetailPage'

vi.mock('../../src/features/exercises/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/exercises/api')>()),
  fetchExercise: vi.fn(),
  copyExercise: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchExercise)
const mockedCopy = vi.mocked(copyExercise)
const t = es.exercises

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'c1',
    origin: 'imported',
    source_item_id: 'Barbell_Squat',
    imported_at: '2026-10-21T12:00:00Z',
    based_on_exercise_id: null,
    name: 'Sentadilla con barra',
    name_status: 'machine_translated',
    original_name: 'Barbell Squat',
    aliases: [],
    measurement_type: 'reps_weight',
    primary_muscles: ['quadriceps'],
    secondary_muscles: [],
    equipment: 'barbell',
    description: null,
    description_status: null,
    source: { id: 's1', slug: 'free-exercise-db', name: 'free-exercise-db' },
    based_on: null,
    ...overrides,
  }
}

function renderDetail(id = 'c1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/ejercicios/${id}`]}>
        <Routes>
          <Route path="/ejercicios/:id" element={<ExerciseDetailPage />} />
          <Route path="/ejercicios/:id/editar" element={<h1>Editar la copia</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(exercise())
  mockedCopy.mockReset().mockResolvedValue('copy-1')
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('Crear mi versión (FR-026)', () => {
  it('crea la copia de un ejercicio del catálogo y lleva a su edición', async () => {
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.createMine }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    expect(mockedCopy).toHaveBeenCalledTimes(1)
    const [id, requestId] = mockedCopy.mock.calls[0]!
    expect(id).toBe('c1')
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('un ejercicio propio ofrece «Crear una copia» y la crea igual', async () => {
    mockedFetch.mockResolvedValue(
      exercise({
        id: 'o1',
        origin: 'own',
        source: null,
        source_item_id: null,
        original_name: null,
      }),
    )
    renderDetail('o1')
    await userEvent.click(await screen.findByRole('button', { name: t.actions.copy }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    expect(mockedCopy.mock.calls[0]![0]).toBe('o1')
  })

  it('FR-029: el doble clic crea una sola copia', async () => {
    let resolve: (id: string) => void = () => {}
    mockedCopy.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderDetail()
    const button = await screen.findByRole('button', { name: t.actions.createMine })
    await userEvent.dblClick(button)
    expect(mockedCopy).toHaveBeenCalledTimes(1)
    resolve('copy-1')
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
  })

  it('sin conexión no se da por creada: avisa y no llama al servidor', async () => {
    renderDetail()
    const button = await screen.findByRole('button', { name: t.actions.createMine })
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await userEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(mockedCopy).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Editar la copia' })).toBeNull()
  })

  it('si falla, avisa, permite reintentar y reutiliza el mismo identificador de solicitud', async () => {
    mockedCopy.mockRejectedValueOnce(new Error('boom')).mockResolvedValue('copy-1')
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.createMine }))
    expect(await screen.findByRole('alert')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: t.actions.createMine }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    expect(mockedCopy.mock.calls[0]![1]).toBe(mockedCopy.mock.calls[1]![1])
  })

  it('si el ejercicio ya no existe, lo dice con un mensaje claro', async () => {
    mockedCopy.mockRejectedValue(new Error('not_found: el ejercicio no existe'))
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.createMine }))
    expect(await screen.findByRole('alert')).toHaveTextContent(t.notFound)
  })

  it('copiar dos veces el mismo ejercicio crea dos copias (cada visita a la pantalla usa su propio identificador)', async () => {
    mockedCopy.mockResolvedValueOnce('copy-1').mockResolvedValueOnce('copy-2')
    const first = renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.createMine }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    first.unmount()

    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: t.actions.createMine }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    expect(mockedCopy).toHaveBeenCalledTimes(2)
    expect(mockedCopy.mock.calls[0]![1]).not.toBe(mockedCopy.mock.calls[1]![1])
  })

  it('la copia dice de qué ejercicio se basa, con un enlace al original', async () => {
    mockedFetch.mockResolvedValue(
      exercise({
        id: 'copy-1',
        origin: 'own',
        source: null,
        source_item_id: null,
        original_name: null,
        based_on_exercise_id: 'c1',
        based_on: { id: 'c1', name: 'Sentadilla con barra' },
      }),
    )
    renderDetail('copy-1')
    expect(await screen.findByText(new RegExp(t.provenance.ownBasedOnPrefix))).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sentadilla con barra' })).toHaveAttribute(
      'href',
      '/ejercicios/c1',
    )
  })
})
