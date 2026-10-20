// T021 (spec 005, FR-001 a FR-005, FR-009 a FR-013): pantalla de búsqueda de ejercicios.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  catalogHasExercises,
  searchExercises,
  type ExerciseSummary,
} from '../../src/features/exercises/api'
import { ExerciseSearchPage } from '../../src/features/exercises/ExerciseSearchPage'

vi.mock('../../src/features/exercises/api', () => ({
  searchExercises: vi.fn(),
  catalogHasExercises: vi.fn(),
}))

const mockedSearch = vi.mocked(searchExercises)
const mockedCatalog = vi.mocked(catalogHasExercises)
const t = es.exercises

function exercise(overrides: Partial<ExerciseSummary> = {}): ExerciseSummary {
  return {
    id: 'e1',
    name: 'Sentadilla con barra',
    name_status: 'machine_translated',
    measurement_type: 'reps_weight',
    primary_muscles: ['quadriceps'],
    equipment: 'barbell',
    origin: 'imported',
    based_on_exercise_id: null,
    source_name: 'free-exercise-db',
    total_estimate: 1,
    ...overrides,
  }
}

function many(count: number, total = count, start = 0): ExerciseSummary[] {
  return Array.from({ length: count }, (_, i) =>
    exercise({ id: `e${start + i}`, name: `Ejercicio ${start + i}`, total_estimate: total }),
  )
}

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="url">{decodeURIComponent(location.pathname + location.search)}</output>
  )
}

function DetailStub() {
  const navigate = useNavigate()
  return (
    <div>
      <h1>Detalle</h1>
      <button type="button" onClick={() => void navigate(-1)}>
        Atrás
      </button>
    </div>
  )
}

function renderPage(initialEntry = '/ejercicios') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <Routes>
          <Route path="/ejercicios" element={<ExerciseSearchPage />} />
          <Route path="/ejercicios/nuevo" element={<h1>Crear ejercicio</h1>} />
          <Route path="/ejercicios/:id" element={<DetailStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const searchBox = () => screen.getByLabelText(t.searchLabel)
const url = () => screen.getByTestId('url').textContent
const lastCall = () => mockedSearch.mock.calls.at(-1)![0]

beforeEach(() => {
  mockedSearch.mockReset().mockResolvedValue([])
  mockedCatalog.mockReset().mockResolvedValue(true)
})

describe('mínimo de caracteres (FR-011)', () => {
  it('sin texto ni filtros indica cómo buscar y no consulta', () => {
    renderPage()
    expect(screen.getByText(t.searchTooShort)).toBeVisible()
    expect(mockedSearch).not.toHaveBeenCalled()
  })

  it('con una sola letra tampoco consulta', async () => {
    renderPage()
    await userEvent.type(searchBox(), 's')
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(mockedSearch).not.toHaveBeenCalled()
    expect(screen.getByText(t.searchTooShort)).toBeVisible()
  })

  it('con dos letras consulta, con el texto recortado y sin filtros', async () => {
    renderPage()
    await userEvent.type(searchBox(), '  se ')
    await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
    expect(lastCall()).toMatchObject({
      q: 'se',
      scope: 'all',
      muscle: null,
      equipment: null,
      pageOffset: 0,
    })
  })
})

describe('resultados (FR-004)', () => {
  it('muestra nombre, tipo de medición en palabras, músculo principal, equipamiento y origen', async () => {
    mockedSearch.mockResolvedValue([
      exercise(),
      exercise({
        id: 'e2',
        name: 'Mi plancha',
        origin: 'own',
        source_name: null,
        measurement_type: 'duration',
        primary_muscles: [],
        equipment: null,
        total_estimate: 2,
      }),
    ])
    renderPage('/ejercicios?q=pl')
    const first = (await screen.findByText('Sentadilla con barra')).closest('li')!
    expect(within(first).getByText('Repeticiones y peso')).toBeVisible()
    expect(within(first).getByText(/Cuádriceps/)).toBeVisible()
    expect(within(first).getByText(/Barra/)).toBeVisible()
    expect(within(first).getByText(t.originBadge.catalog)).toBeVisible()

    const second = screen.getByText('Mi plancha').closest('li')!
    expect(within(second).getByText('Tiempo')).toBeVisible()
    expect(within(second).getByText(`${t.missing} · ${t.missing}`)).toBeVisible()
    expect(within(second).getByText(t.originBadge.own)).toBeVisible()
  })

  it('cada resultado lleva al detalle y el nombre largo se recorta', async () => {
    mockedSearch.mockResolvedValue([exercise({ name: 'N'.repeat(200) })])
    renderPage('/ejercicios?q=nn')
    const link = await screen.findByRole('link', { name: /N{20}/ })
    expect(link).toHaveAttribute('href', '/ejercicios/e1')
    expect(within(link).getByText(/^N+$/)).toHaveClass('truncate')
  })

  it('anuncia la cantidad de resultados sin mover el foco', async () => {
    mockedSearch.mockResolvedValue(many(3, 3))
    renderPage('/ejercicios?q=ej')
    const count = await screen.findByText('3 resultados')
    expect(count.parentElement).toHaveAttribute('aria-live', 'polite')
  })

  it('«Ver más» suma resultados sin perder los anteriores', async () => {
    mockedSearch.mockResolvedValueOnce(many(20, 25)).mockResolvedValueOnce(many(5, 25, 20))
    renderPage('/ejercicios?q=ej')
    await screen.findByText('Ejercicio 0')
    await userEvent.click(screen.getByRole('button', { name: t.loadMore }))
    expect(await screen.findByText('Ejercicio 24')).toBeVisible()
    expect(screen.getByText('Ejercicio 0')).toBeVisible()
    expect(lastCall().pageOffset).toBe(20)
    expect(screen.queryByRole('button', { name: t.loadMore })).not.toBeInTheDocument()
  })
})

describe('estados (FR-009, FR-010)', () => {
  it('mientras busca muestra «Buscando…»', () => {
    mockedSearch.mockReturnValue(new Promise(() => {}))
    renderPage('/ejercicios?q=ej')
    expect(screen.getByText(t.searching)).toBeVisible()
  })

  it('sin resultados ofrece crear el ejercicio con lo buscado', async () => {
    renderPage('/ejercicios?q=zzz')
    expect(await screen.findByText(t.emptyTitle)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: t.createNamed('zzz') }))
    expect(url()).toBe('/ejercicios/nuevo?nombre=zzz')
  })

  it('catálogo vacío en la pestaña del catálogo lo dice', async () => {
    mockedCatalog.mockResolvedValue(false)
    renderPage('/ejercicios?q=zzz&origen=catalogo')
    expect(await screen.findByText(t.catalogEmpty)).toBeVisible()
  })

  it('con filtros activos y sin resultados dice cuáles son y permite quitarlos, sin botón de crear', async () => {
    renderPage('/ejercicios?musculo=chest&equipo=barbell')
    expect(await screen.findByText(t.emptyFiltersTitle)).toBeVisible()
    expect(screen.getByText(t.emptyFiltersBody('Pecho, Barra'))).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Crear "/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t.clearFilters }))
    expect(url()).toBe('/ejercicios')
    expect(await screen.findByText(t.searchTooShort)).toBeVisible()
  })

  it('si falla la búsqueda avisa y permite reintentar', async () => {
    mockedSearch.mockRejectedValueOnce(new Error('boom'))
    renderPage('/ejercicios?q=ej')
    expect(await screen.findByText(t.searchError)).toBeVisible()
    mockedSearch.mockResolvedValue(many(1))
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByText('Ejercicio 0')).toBeVisible()
  })

  it('sin conexión usa el mensaje de sin conexión', async () => {
    mockedSearch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderPage('/ejercicios?q=ej')
    expect(await screen.findByText(t.offlineSearch)).toBeVisible()
  })
})

describe('pestañas de origen (FR-012)', () => {
  it('cambiar de pestaña consulta con ese origen y lo guarda en la URL', async () => {
    renderPage('/ejercicios?q=ej')
    await screen.findByText(t.emptyTitle)
    await userEvent.click(screen.getByRole('tab', { name: t.tabs.own }))
    await waitFor(() => expect(lastCall().scope).toBe('own'))
    expect(url()).toBe('/ejercicios?q=ej&origen=propios')
    await userEvent.click(screen.getByRole('tab', { name: t.tabs.catalog }))
    await waitFor(() => expect(lastCall().scope).toBe('catalog'))
    expect(url()).toContain('origen=catalogo')
  })

  it('el texto, la pestaña y los filtros sobreviven a ir al detalle y volver', async () => {
    mockedSearch.mockResolvedValue([exercise()])
    renderPage('/ejercicios?q=sent&origen=catalogo&musculo=quadriceps')
    await userEvent.click(await screen.findByRole('link', { name: /Sentadilla con barra/ }))
    expect(await screen.findByText('Detalle')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByText('Sentadilla con barra')).toBeVisible()
    expect(url()).toBe('/ejercicios?q=sent&origen=catalogo&musculo=quadriceps')
    expect(searchBox()).toHaveValue('sent')
    expect(screen.getByRole('tab', { name: t.tabs.catalog })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})

describe('filtros por músculo y equipamiento (FR-005)', () => {
  it('elegir un músculo busca solo con el filtro, sin texto', async () => {
    mockedSearch.mockResolvedValue(many(2))
    renderPage()
    await userEvent.selectOptions(screen.getByLabelText(t.filters.muscle), 'chest')
    await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
    expect(lastCall()).toMatchObject({ q: '', muscle: 'chest', equipment: null })
    expect(url()).toBe('/ejercicios?musculo=chest')
    expect(await screen.findByText('Ejercicio 0')).toBeVisible()
  })

  it('músculo, equipamiento y texto se combinan', async () => {
    renderPage('/ejercicios?q=press')
    await userEvent.selectOptions(screen.getByLabelText(t.filters.muscle), 'chest')
    await userEvent.selectOptions(screen.getByLabelText(t.filters.equipment), 'dumbbell')
    await waitFor(() =>
      expect(lastCall()).toMatchObject({ q: 'press', muscle: 'chest', equipment: 'dumbbell' }),
    )
    expect(url()).toBe('/ejercicios?q=press&musculo=chest&equipo=dumbbell')
  })

  it('con una sola letra y un filtro busca solo con el filtro', async () => {
    renderPage('/ejercicios?musculo=lats')
    await userEvent.type(searchBox(), 'p')
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(lastCall()).toMatchObject({ q: '', muscle: 'lats' })
  })

  it('cada filtro activo es una etiqueta con «Quitar»', async () => {
    mockedSearch.mockResolvedValue(many(1))
    renderPage('/ejercicios?musculo=chest&equipo=dumbbell')
    await screen.findByText('Ejercicio 0')
    expect(screen.getByRole('button', { name: t.filters.remove('Pecho') })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: t.filters.remove('Pecho') }))
    await waitFor(() => expect(url()).toBe('/ejercicios?equipo=dumbbell'))
    expect(lastCall()).toMatchObject({ muscle: null, equipment: 'dumbbell' })
  })

  it('las listas ofrecen todos los músculos y todo el equipamiento, en español', () => {
    renderPage()
    const muscles = within(screen.getByLabelText(t.filters.muscle)).getAllByRole('option')
    expect(muscles).toHaveLength(19)
    expect(muscles[0]).toHaveTextContent(t.filters.muscleAll)
    const equipment = within(screen.getByLabelText(t.filters.equipment)).getAllByRole('option')
    expect(equipment).toHaveLength(13)
    expect(equipment[0]).toHaveTextContent(t.filters.equipmentAll)
  })

  it('ignora un filtro de la URL que no está en la lista', async () => {
    renderPage('/ejercicios?musculo=pecho')
    expect(screen.getByText(t.searchTooShort)).toBeVisible()
    expect(mockedSearch).not.toHaveBeenCalled()
  })
})
