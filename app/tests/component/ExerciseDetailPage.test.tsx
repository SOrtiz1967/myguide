// T022 (spec 005, FR-006, FR-007, FR-013, FR-015, FR-017, FR-020): detalle de un ejercicio.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchExercise, type Exercise } from '../../src/features/exercises/api'
import { ExerciseDetailPage } from '../../src/features/exercises/ExerciseDetailPage'

vi.mock('../../src/features/exercises/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/exercises/api')>()),
  fetchExercise: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchExercise)
const t = es.exercises

function catalogExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'c1',
    origin: 'imported',
    source_item_id: 'Barbell_Squat',
    imported_at: '2026-10-21T12:00:00Z',
    based_on_exercise_id: null,
    name: 'Sentadilla con barra',
    name_status: 'machine_translated',
    original_name: 'Barbell Squat',
    aliases: ['Cuclillas con barra'],
    measurement_type: 'reps_weight',
    primary_muscles: ['quadriceps'],
    secondary_muscles: ['glutes', 'hamstrings'],
    equipment: 'barbell',
    description:
      '1. Apoya la barra sobre la espalda.\n2. Baja hasta que los muslos queden paralelos.\n3. Sube.',
    description_status: 'machine_translated',
    source: { id: 's1', slug: 'free-exercise-db', name: 'free-exercise-db' },
    based_on: null,
    ...overrides,
  }
}

function ownExercise(overrides: Partial<Exercise> = {}): Exercise {
  return catalogExercise({
    id: 'o1',
    origin: 'own',
    source_item_id: null,
    imported_at: null,
    source: null,
    name: 'Mi plancha',
    name_status: 'original',
    original_name: null,
    aliases: [],
    description_status: 'original',
    ...overrides,
  })
}

function renderPage(id = 'c1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/ejercicios/${id}`]}>
        <Routes>
          <Route path="/ejercicios" element={<h1>Búsqueda</h1>} />
          <Route path="/ejercicios/:id" element={<ExerciseDetailPage />} />
          <Route path="/fuentes" element={<h1>Fuentes</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** El valor de una sección del detalle por su título. */
const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section')!

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(catalogExercise())
})

describe('un ejercicio completo', () => {
  it('muestra el nombre, los otros nombres, el tipo explicado, los músculos y el equipamiento', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { level: 1, name: /Sentadilla con barra/ }),
    ).toBeVisible()
    expect(within(section(t.detail.alsoKnownAs)).getByText('Barbell Squat')).toBeVisible()
    expect(within(section(t.detail.alsoKnownAs)).getByText('Cuclillas con barra')).toBeVisible()
    expect(
      within(section(t.detail.measurement)).getByText('Se registra con repeticiones y peso'),
    ).toBeVisible()
    expect(within(section(t.detail.primaryMuscles)).getByText('Cuádriceps')).toBeVisible()
    expect(
      within(section(t.detail.secondaryMuscles)).getByText('Glúteos, Isquiotibiales'),
    ).toBeVisible()
    expect(within(section(t.detail.equipment)).getByText('Barra')).toBeVisible()
  })

  it('los pasos se muestran como una lista numerada, sin repetir el número', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    const steps = within(section(t.detail.description)).getAllByRole('listitem')
    expect(steps.map((s) => s.textContent)).toEqual([
      'Apoya la barra sobre la espalda.',
      'Baja hasta que los muslos queden paralelos.',
      'Sube.',
    ])
    expect(within(section(t.detail.description)).getByRole('list').tagName).toBe('OL')
  })

  it('una descripción de texto libre se muestra con sus saltos de línea', async () => {
    mockedFetch.mockResolvedValue(ownExercise({ description: 'Caminata cómoda.\nSin apuro.' }))
    renderPage('o1')
    await screen.findByRole('heading', { level: 1 })
    const text = within(section(t.detail.description)).getByText(/Caminata cómoda/)
    expect(text.textContent).toBe('Caminata cómoda.\nSin apuro.')
    expect(text).toHaveClass('whitespace-pre-line')
  })
})

describe('datos que faltan (FR-007)', () => {
  it('músculos, equipamiento y descripción ausentes dicen «sin dato», nunca vacío ni «Peso corporal»', async () => {
    mockedFetch.mockResolvedValue(
      catalogExercise({
        aliases: [],
        original_name: null,
        primary_muscles: [],
        secondary_muscles: [],
        equipment: null,
        description: null,
        description_status: null,
      }),
    )
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(within(section(t.detail.primaryMuscles)).getByText(t.missing)).toBeVisible()
    expect(within(section(t.detail.secondaryMuscles)).getByText(t.missing)).toBeVisible()
    expect(within(section(t.detail.equipment)).getByText(t.missing)).toBeVisible()
    expect(within(section(t.detail.description)).getByText(t.missing)).toBeVisible()
    expect(screen.queryByText('Peso corporal')).not.toBeInTheDocument()
    expect(screen.queryByText(t.detail.alsoKnownAs)).not.toBeInTheDocument()
  })

  it('«Peso corporal» es un valor informado, distinto de no tener dato', async () => {
    mockedFetch.mockResolvedValue(catalogExercise({ equipment: 'body only' }))
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(within(section(t.detail.equipment)).getByText('Peso corporal')).toBeVisible()
  })
})

describe('procedencia y traducción (FR-017, FR-020)', () => {
  it('un ejercicio del catálogo muestra fuente, código y fecha, y enlaza a las fuentes', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    const provenance = section(t.provenance.title)
    expect(
      within(provenance).getByText(
        'Del catálogo · free-exercise-db · código Barbell_Squat · importado el 21/10/2026',
      ),
    ).toBeVisible()
    expect(
      within(provenance).getByRole('link', { name: t.provenance.viewSources }),
    ).toHaveAttribute('href', '/fuentes')
  })

  it('un ejercicio propio dice «Propio», y una copia dice de cuál se basa', async () => {
    mockedFetch.mockResolvedValue(ownExercise())
    const first = renderPage('o1')
    await screen.findByRole('heading', { level: 1 })
    expect(within(section(t.provenance.title)).getByText('Propio')).toBeVisible()
    first.unmount()

    mockedFetch.mockResolvedValue(
      ownExercise({ based_on_exercise_id: 'c1', based_on: { id: 'c1', name: 'Plancha' } }),
    )
    renderPage('o1')
    await screen.findByRole('heading', { level: 1 })
    expect(
      within(section(t.provenance.title)).getByText(t.provenance.ownBasedOnPrefix),
    ).toBeVisible()
    expect(
      within(section(t.provenance.title)).getByRole('link', { name: 'Plancha' }),
    ).toHaveAttribute('href', '/ejercicios/c1')
  })

  it('«traducción sin revisar» aparece junto al nombre y junto a la descripción, cada uno por su estado', async () => {
    mockedFetch.mockResolvedValue(
      catalogExercise({ name_status: 'machine_translated', description_status: 'reviewed' }),
    )
    renderPage()
    const title = await screen.findByRole('heading', { level: 1 })
    expect(
      within(title.closest('header')!).getByText(t.textStatus.machine_translated),
    ).toBeVisible()
    expect(
      within(section(t.detail.description)).queryByText(t.textStatus.machine_translated),
    ).not.toBeInTheDocument()
  })

  it('lo revisado y lo original no llevan etiqueta de traducción', async () => {
    mockedFetch.mockResolvedValue(
      catalogExercise({ name_status: 'reviewed', description_status: 'reviewed' }),
    )
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(t.textStatus.machine_translated)).not.toBeInTheDocument()
  })
})

describe('acciones según el origen', () => {
  it('del catálogo: «Crear mi versión»; sin editar ni eliminar', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('button', { name: t.actions.createMine })).toBeVisible()
    expect(screen.queryByRole('link', { name: t.actions.edit })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.actions.delete })).not.toBeInTheDocument()
  })

  it('propio: «Editar», «Eliminar» y «Crear una copia»', async () => {
    mockedFetch.mockResolvedValue(ownExercise())
    renderPage('o1')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: t.actions.edit })).toHaveAttribute(
      'href',
      '/ejercicios/o1/editar',
    )
    expect(screen.getByRole('button', { name: t.actions.delete })).toBeVisible()
    expect(screen.getByRole('button', { name: t.actions.copy })).toBeVisible()
    expect(screen.queryByRole('button', { name: t.actions.createMine })).not.toBeInTheDocument()
  })
})

describe('estados', () => {
  it('mientras carga', () => {
    mockedFetch.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeVisible()
  })

  it('un ejercicio inexistente o ajeno dice «No encontramos este ejercicio»', async () => {
    mockedFetch.mockResolvedValue(null)
    renderPage('nada')
    expect(await screen.findByText(t.notFound)).toBeVisible()
    expect(screen.getByRole('link', { name: t.backToSearch })).toHaveAttribute(
      'href',
      '/ejercicios',
    )
  })

  it('si falla la carga avisa y permite reintentar', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText(t.detailError)).toBeVisible()
    mockedFetch.mockResolvedValue(catalogExercise())
    screen.getByRole('button', { name: es.common.retry }).click()
    expect(
      await screen.findByRole('heading', { level: 1, name: /Sentadilla con barra/ }),
    ).toBeVisible()
  })
})
