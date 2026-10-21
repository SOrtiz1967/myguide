// T066 (spec 002, FR-012) y T059 (spec 005, FR-018): pantalla de fuentes con licencia, atribución, fecha y
// cantidad, en dos secciones: alimentos y ejercicios.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchExerciseSources, type ExerciseSource } from '../../src/features/exercises/api'
import { fetchSources, type FoodSource } from '../../src/features/foods/api'
import { SourcesPage } from '../../src/features/foods/SourcesPage'

vi.mock('../../src/features/foods/api', () => ({ fetchSources: vi.fn() }))
vi.mock('../../src/features/exercises/api', () => ({ fetchExerciseSources: vi.fn() }))
const mockedFetch = vi.mocked(fetchSources)
const mockedFetchExercises = vi.mocked(fetchExerciseSources)

const off: FoodSource = {
  id: 's1',
  slug: 'open-food-facts',
  name: 'Open Food Facts',
  license_name: 'ODbL 1.0',
  license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution:
    'Datos de productos de Open Food Facts (openfoodfacts.org), bajo la licencia ODbL 1.0.',
  source_url: 'https://world.openfoodfacts.org',
  last_imported_at: '2026-10-18T12:00:00Z',
  food_count: 3929,
}
const usda: FoodSource = {
  id: 's2',
  slug: 'usda-fdc',
  name: 'USDA FoodData Central',
  license_name: 'CC0 1.0',
  license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  attribution: 'Datos de composición de alimentos de USDA FoodData Central, de dominio público.',
  source_url: 'https://fdc.nal.usda.gov',
  last_imported_at: null,
  food_count: 0,
}

const freeDb: ExerciseSource = {
  id: 'x1',
  slug: 'free-exercise-db',
  name: 'free-exercise-db',
  license_name: 'The Unlicense',
  license_url: 'https://unlicense.org/',
  attribution: 'Datos de ejercicios de free-exercise-db, de dominio público.',
  source_url: 'https://github.com/yuhonas/free-exercise-db',
  last_imported_at: '2026-10-21T12:00:00Z',
  exercise_count: 876,
}
const base: ExerciseSource = {
  id: 'x2',
  slug: 'myguide-base',
  name: 'Ejercicios base de MyGuide',
  license_name: 'CC0 1.0',
  license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  attribution: 'Ejercicios escritos por el autor de MyGuide, de dominio público.',
  source_url: 'https://example.org/myguide',
  last_imported_at: null,
  exercise_count: 1,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SourcesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue([off, usda])
  mockedFetchExercises.mockReset().mockResolvedValue([freeDb, base])
})

describe('SourcesPage', () => {
  it('lista cada fuente con licencia, atribución, fecha de importación y cantidad', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { level: 1, name: es.foods.sources.title }),
    ).toBeVisible()
    const card = (await screen.findByRole('heading', { name: 'Open Food Facts' })).closest(
      'article',
    )!

    expect(within(card).getByRole('link', { name: 'ODbL 1.0' })).toHaveAttribute(
      'href',
      'https://opendatacommons.org/licenses/odbl/1-0/',
    )
    expect(within(card).getByText(off.attribution)).toBeVisible()
    expect(within(card).getByText('18/10/2026')).toBeVisible()
    expect(within(card).getByText('3.929 alimentos')).toBeVisible()
    expect(within(card).getByRole('link', { name: es.foods.sources.siteLink })).toHaveAttribute(
      'href',
      'https://world.openfoodfacts.org',
    )
  })

  it('una fuente que todavía no se importó lo dice', async () => {
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'USDA FoodData Central' })).closest(
      'article',
    )!
    expect(within(card).getByText(es.foods.sources.neverImported)).toBeVisible()
    expect(within(card).getByText('0 alimentos')).toBeVisible()
  })

  it('los enlaces externos abren en otra pestaña de forma segura', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'ODbL 1.0' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('sin fuentes muestra el estado vacío', async () => {
    mockedFetch.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(es.foods.sources.empty)).toBeVisible()
  })

  it('muestra la carga', async () => {
    mockedFetch.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(await screen.findByRole('status')).toBeVisible()
  })

  it('si falla, avisa y permite reintentar', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([off])
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.foods.sources.error)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('heading', { name: 'Open Food Facts' })).toBeVisible()
  })
})

describe('SourcesPage: enlaces no confiables (T074)', () => {
  it('un enlace que no es http(s) se muestra como texto, no como enlace', async () => {
    mockedFetch.mockResolvedValue([
      { ...off, license_url: 'javascript:alert(1)', source_url: 'data:text/html,x' },
    ])
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'Open Food Facts' })).closest(
      'article',
    )!
    expect(within(card).queryByRole('link')).toBeNull()
    expect(within(card).getByText('ODbL 1.0')).toBeVisible()
  })
})

describe('SourcesPage: ejercicios (FR-018)', () => {
  it('tiene dos secciones, Alimentos y Ejercicios, cada una con sus fuentes', async () => {
    renderPage()
    const foods = (
      await screen.findByRole('heading', { level: 2, name: es.exercises.sources.foodsTitle })
    ).closest('section')!
    const exercises = (
      await screen.findByRole('heading', { level: 2, name: es.exercises.sources.exercisesTitle })
    ).closest('section')!
    expect(within(foods).getByRole('heading', { name: 'Open Food Facts' })).toBeVisible()
    expect(within(foods).queryByRole('heading', { name: 'free-exercise-db' })).toBeNull()
    expect(within(exercises).getByRole('heading', { name: 'free-exercise-db' })).toBeVisible()
    expect(within(exercises).queryByRole('heading', { name: 'Open Food Facts' })).toBeNull()
  })

  it('cada fuente de ejercicios muestra licencia, atribución, fecha y cantidad', async () => {
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'free-exercise-db' })).closest(
      'article',
    )!
    expect(within(card).getByRole('link', { name: 'The Unlicense' })).toHaveAttribute(
      'href',
      'https://unlicense.org/',
    )
    expect(within(card).getByText(freeDb.attribution)).toBeVisible()
    expect(within(card).getByText('21/10/2026')).toBeVisible()
    expect(within(card).getByText('876 ejercicios')).toBeVisible()
    expect(within(card).getByRole('link', { name: es.foods.sources.siteLink })).toHaveAttribute(
      'href',
      'https://github.com/yuhonas/free-exercise-db',
    )
  })

  it('una fuente de ejercicios sin importar lo dice y la cantidad singular se escribe bien', async () => {
    renderPage()
    const card = (
      await screen.findByRole('heading', { name: 'Ejercicios base de MyGuide' })
    ).closest('article')!
    expect(within(card).getByText(es.foods.sources.neverImported)).toBeVisible()
    expect(within(card).getByText('1 ejercicio')).toBeVisible()
  })

  it('sin fuentes de ejercicios muestra el estado vacío solo en esa sección', async () => {
    mockedFetchExercises.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(es.exercises.sources.empty)).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Open Food Facts' })).toBeVisible()
  })

  it('si fallan las de ejercicios, avisa en su sección sin ocultar las de alimentos, y permite reintentar', async () => {
    mockedFetchExercises.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([freeDb])
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.exercises.sources.error)
    expect(await screen.findByRole('heading', { name: 'Open Food Facts' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('heading', { name: 'free-exercise-db' })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si fallan las de alimentos, las de ejercicios siguen visibles', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.foods.sources.error)
    expect(await screen.findByRole('heading', { name: 'free-exercise-db' })).toBeVisible()
  })

  it('los enlaces de las fuentes de ejercicios que no son http(s) se muestran como texto', async () => {
    mockedFetchExercises.mockResolvedValue([
      { ...freeDb, license_url: 'javascript:alert(1)', source_url: 'data:text/html,x' },
    ])
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'free-exercise-db' })).closest(
      'article',
    )!
    expect(within(card).queryByRole('link')).toBeNull()
    expect(within(card).getByText('The Unlicense')).toBeVisible()
  })
})
