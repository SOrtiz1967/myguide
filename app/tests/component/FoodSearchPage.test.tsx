// T020 (spec 002, FR-001 a FR-004, FR-009, FR-010, FR-032, FR-033): pantalla de búsqueda de alimentos.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { catalogHasFoods, searchFoods, type FoodSummary } from '../../src/features/foods/api'
import { FoodSearchPage } from '../../src/features/foods/FoodSearchPage'

vi.mock('../../src/features/foods/api', () => ({ searchFoods: vi.fn(), catalogHasFoods: vi.fn() }))

const mockedSearch = vi.mocked(searchFoods)
const mockedCatalog = vi.mocked(catalogHasFoods)

function food(overrides: Partial<FoodSummary> = {}): FoodSummary {
  return {
    id: 'f1',
    name: 'Arroz blanco',
    name_status: 'original',
    brand: null,
    reference_basis: '100g',
    energy_kcal: 130,
    origin: 'imported',
    based_on_food_id: null,
    source_name: 'USDA FoodData Central',
    total_estimate: 1,
    ...overrides,
  }
}

function many(count: number, total = count, start = 0): FoodSummary[] {
  return Array.from({ length: count }, (_, i) =>
    food({ id: `f${start + i}`, name: `Alimento ${start + i}`, total_estimate: total }),
  )
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
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

function renderPage(initialEntry = '/alimentos') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <Routes>
          <Route path="/alimentos" element={<FoodSearchPage />} />
          <Route path="/alimentos/nuevo" element={<h1>Crear alimento</h1>} />
          <Route path="/alimentos/:id" element={<DetailStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const searchBox = () => screen.getByRole('searchbox', { name: es.foods.searchLabel })

beforeEach(() => {
  mockedSearch.mockReset().mockResolvedValue([])
  mockedCatalog.mockReset().mockResolvedValue(true)
})

describe('FoodSearchPage: búsqueda', () => {
  it('FR-032: pide al menos 2 caracteres y no consulta con menos', async () => {
    renderPage()
    expect(screen.getByText(es.foods.searchTooShort)).toBeVisible()
    await userEvent.type(searchBox(), 'a')
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(mockedSearch).not.toHaveBeenCalled()
    expect(screen.getByText(es.foods.searchTooShort)).toBeVisible()
  })

  it('espera 300 ms tras dejar de escribir y hace una sola consulta', async () => {
    renderPage()
    await userEvent.type(searchBox(), 'arroz')
    expect(mockedSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1))
    expect(mockedSearch).toHaveBeenCalledWith({
      q: 'arroz',
      scope: 'all',
      pageSize: 20,
      pageOffset: 0,
    })
  })

  it('FR-004: cada resultado muestra nombre, marca, base, energía y el origen', async () => {
    mockedSearch.mockResolvedValue([
      food({ id: 'c1', brand: 'Gallo', total_estimate: 2 }),
      food({
        id: 'o1',
        name: 'Mi arroz',
        origin: 'own',
        source_name: null,
        energy_kcal: 120,
        reference_basis: '100ml',
        total_estimate: 2,
      }),
    ])
    renderPage('/alimentos?q=arroz')
    const catalogItem = (await screen.findByRole('link', { name: /Arroz blanco/ })).closest('li')!
    expect(within(catalogItem).getByText('Gallo')).toBeVisible()
    expect(within(catalogItem).getByText(/130 kcal/)).toBeVisible()
    expect(within(catalogItem).getByText(/por 100 g/)).toBeVisible()
    expect(within(catalogItem).getByText(es.foods.originBadge.catalog)).toBeVisible()

    const ownItem = screen.getByRole('link', { name: /Mi arroz/ }).closest('li')!
    expect(within(ownItem).getByText(/120 kcal/)).toBeVisible()
    expect(within(ownItem).getByText(/por 100 ml/)).toBeVisible()
    expect(within(ownItem).getByText(es.foods.originBadge.own)).toBeVisible()
  })

  it('FR-006: una energía faltante se muestra como "sin dato", no como 0', async () => {
    mockedSearch.mockResolvedValue([food({ energy_kcal: null })])
    renderPage('/alimentos?q=arroz')
    const item = (await screen.findByRole('link', { name: /Arroz blanco/ })).closest('li')!
    expect(within(item).getByText(/sin dato/)).toBeVisible()
    expect(within(item).queryByText(/\b0 kcal/)).toBeNull()
  })

  it('un nombre muy largo, con símbolos o emojis se recorta con puntos suspensivos en la lista', async () => {
    const long =
      'Galletitas "súper" <crocantes> 🍪 con chips de chocolate y dulce de leche '.repeat(3)
    mockedSearch.mockResolvedValue([food({ name: long.trim() })])
    renderPage('/alimentos?q=galletitas')
    const name = await screen.findByText(long.trim())
    expect(name).toHaveClass('truncate')
  })

  it('anuncia la cantidad de resultados sin mover el foco', async () => {
    mockedSearch.mockResolvedValue(many(3))
    renderPage('/alimentos?q=ali')
    const announcement = await screen.findByText('3 resultados')
    expect(announcement.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite')
    expect(searchBox()).not.toHaveFocus()
  })
})

describe('FoodSearchPage: pestañas y URL (FR-033)', () => {
  it('Todos, Del catálogo y Mis alimentos filtran y guardan la búsqueda en la URL', async () => {
    renderPage()
    await userEvent.type(searchBox(), 'arroz')
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/alimentos?q=arroz'))

    await userEvent.click(screen.getByRole('tab', { name: es.foods.tabs.catalog }))
    await waitFor(() =>
      expect(mockedSearch).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'catalog' })),
    )
    expect(screen.getByTestId('url')).toHaveTextContent('origen=catalogo')

    await userEvent.click(screen.getByRole('tab', { name: es.foods.tabs.own }))
    await waitFor(() =>
      expect(mockedSearch).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'own' })),
    )
    expect(screen.getByTestId('url')).toHaveTextContent('origen=propios')
    expect(screen.getByTestId('url')).toHaveTextContent('q=arroz')

    await userEvent.click(screen.getByRole('tab', { name: es.foods.tabs.all }))
    await waitFor(() =>
      expect(mockedSearch).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'all' })),
    )
    expect(screen.getByTestId('url')).not.toHaveTextContent('origen=')
  })

  it('restaura texto y pestaña desde la URL y los conserva al ir al detalle y volver', async () => {
    mockedSearch.mockResolvedValue([food({ id: 'c1', total_estimate: 1 })])
    renderPage('/alimentos?q=arroz&origen=catalogo')
    expect(searchBox()).toHaveValue('arroz')
    expect(screen.getByRole('tab', { name: es.foods.tabs.catalog })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await userEvent.click(await screen.findByRole('link', { name: /Arroz blanco/ }))
    expect(await screen.findByRole('heading', { name: 'Detalle' })).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByRole('searchbox', { name: es.foods.searchLabel })).toHaveValue(
      'arroz',
    )
    expect(screen.getByTestId('url')).toHaveTextContent('/alimentos?q=arroz&origen=catalogo')
    expect(screen.getByRole('tab', { name: es.foods.tabs.catalog })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('las pestañas se recorren con las flechas del teclado', async () => {
    renderPage('/alimentos?q=arroz')
    const all = screen.getByRole('tab', { name: es.foods.tabs.all })
    all.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: es.foods.tabs.catalog })).toHaveFocus()
    expect(screen.getByRole('tab', { name: es.foods.tabs.catalog })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('tab', { name: es.foods.tabs.own })).toHaveFocus()
  })
})

describe('FoodSearchPage: estados (FR-009, FR-010)', () => {
  it('sin resultados ofrece crear lo buscado con el nombre precargado', async () => {
    renderPage('/alimentos?q=quinoa')
    expect(await screen.findByText(es.foods.emptyTitle)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.foods.createNamed('quinoa') }))
    expect(await screen.findByRole('heading', { name: 'Crear alimento' })).toBeVisible()
    expect(screen.getByTestId('url')).toHaveTextContent('/alimentos/nuevo?nombre=quinoa')
  })

  it('catálogo vacío lo informa en lugar de "sin resultados"', async () => {
    mockedCatalog.mockResolvedValue(false)
    renderPage('/alimentos?q=arroz&origen=catalogo')
    expect(await screen.findByText(es.foods.catalogEmpty)).toBeVisible()
  })

  it('"Ver más" agrega la siguiente tanda sin perder la anterior', async () => {
    mockedSearch.mockResolvedValueOnce(many(20, 25)).mockResolvedValueOnce(many(5, 25, 20))
    renderPage('/alimentos?q=ali')
    expect(await screen.findByText('Alimento 0')).toBeVisible()
    expect(screen.getByText('25 resultados')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: es.foods.loadMore }))
    expect(await screen.findByText('Alimento 24')).toBeVisible()
    expect(screen.getByText('Alimento 0')).toBeVisible()
    expect(mockedSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageOffset: 20, pageSize: 20 }),
    )
    expect(screen.queryByRole('button', { name: es.foods.loadMore })).toBeNull()
  })

  it('no muestra resultados viejos mientras carga la búsqueda nueva', async () => {
    mockedSearch.mockResolvedValueOnce([food({ name: 'Arroz blanco' })])
    renderPage('/alimentos?q=arroz')
    expect(await screen.findByText('Arroz blanco')).toBeVisible()

    mockedSearch.mockReturnValue(new Promise(() => {}))
    await userEvent.clear(searchBox())
    await userEvent.type(searchBox(), 'pan')
    expect(await screen.findByText(es.foods.searching)).toBeVisible()
    expect(screen.queryByText('Arroz blanco')).toBeNull()
  })

  it('un fallo de red muestra el aviso sin conexión y permite reintentar', async () => {
    mockedSearch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue([food({ name: 'Arroz blanco' })])
    renderPage('/alimentos?q=arroz')
    expect(await screen.findByRole('alert')).toHaveTextContent(es.foods.offlineSearch)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByText('Arroz blanco')).toBeVisible()
  })

  it('otro fallo muestra un mensaje general con "Reintentar"', async () => {
    mockedSearch.mockRejectedValueOnce(new Error('boom'))
    renderPage('/alimentos?q=arroz')
    expect(await screen.findByRole('alert')).toHaveTextContent(es.foods.searchError)
    expect(screen.getByRole('button', { name: es.common.retry })).toBeVisible()
  })
})
