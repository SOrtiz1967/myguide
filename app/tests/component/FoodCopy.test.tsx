// T055 (spec 002, FR-020, FR-023): crear mi versión de un alimento del catálogo (o una copia de uno propio).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { copyFood, fetchFood, searchFoods, type Food } from '../../src/features/foods/api'
import { FoodDetailPage } from '../../src/features/foods/FoodDetailPage'
import { FoodSearchPage } from '../../src/features/foods/FoodSearchPage'

vi.mock('../../src/features/foods/api', () => ({
  fetchFood: vi.fn(),
  copyFood: vi.fn(),
  searchFoods: vi.fn(),
  catalogHasFoods: vi.fn().mockResolvedValue(true),
}))

const mockedFetch = vi.mocked(fetchFood)
const mockedCopy = vi.mocked(copyFood)
const mockedSearch = vi.mocked(searchFoods)

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: 'c1',
    origin: 'imported',
    source_item_id: '7790',
    imported_at: '2026-10-18T12:00:00Z',
    based_on_food_id: null,
    name: 'Arroz blanco',
    name_status: 'original',
    brand: null,
    reference_basis: '100g',
    energy_kcal: 130,
    protein_g: null,
    carbs_g: null,
    sugars_g: null,
    fat_g: null,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: null,
    portions: [],
    source: { id: 's1', slug: 'usda-fdc', name: 'USDA FoodData Central' },
    based_on: null,
    ...overrides,
  }
}

function renderDetail(id = 'c1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/alimentos/${id}`]}>
        <Routes>
          <Route path="/alimentos/:id" element={<FoodDetailPage />} />
          <Route path="/alimentos/:id/editar" element={<h1>Editar la copia</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(food())
  mockedCopy.mockReset().mockResolvedValue('copy-1')
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('Crear mi versión (FR-020)', () => {
  it('crea la copia de un alimento del catálogo y lleva a su edición', async () => {
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: es.foods.actions.createMine }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    expect(mockedCopy).toHaveBeenCalledTimes(1)
    const [id, requestId] = mockedCopy.mock.calls[0]!
    expect(id).toBe('c1')
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('un alimento propio ofrece "Crear una copia" y la crea igual', async () => {
    mockedFetch.mockResolvedValue(
      food({ id: 'o1', origin: 'own', source: null, source_item_id: null }),
    )
    renderDetail('o1')
    await userEvent.click(await screen.findByRole('button', { name: es.foods.actions.copy }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    expect(mockedCopy.mock.calls[0]![0]).toBe('o1')
  })

  it('FR-023: el doble clic crea una sola copia', async () => {
    let resolve: (id: string) => void = () => {}
    mockedCopy.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderDetail()
    const button = await screen.findByRole('button', { name: es.foods.actions.createMine })
    await userEvent.dblClick(button)
    expect(mockedCopy).toHaveBeenCalledTimes(1)
    resolve('copy-1')
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
  })

  it('sin conexión no se da por creada: avisa y no llama al servidor', async () => {
    renderDetail()
    const button = await screen.findByRole('button', { name: es.foods.actions.createMine })
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await userEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(mockedCopy).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Editar la copia' })).toBeNull()
  })

  it('si falla, avisa, permite reintentar y reutiliza el mismo identificador de solicitud', async () => {
    mockedCopy.mockRejectedValueOnce(new Error('boom')).mockResolvedValue('copy-1')
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: es.foods.actions.createMine }))
    expect(await screen.findByRole('alert')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.foods.actions.createMine }))
    expect(await screen.findByRole('heading', { name: 'Editar la copia' })).toBeVisible()
    expect(mockedCopy.mock.calls[0]![1]).toBe(mockedCopy.mock.calls[1]![1])
  })

  it('la copia dice de qué alimento se basa, con un enlace al original', async () => {
    mockedFetch.mockResolvedValue(
      food({
        id: 'copy-1',
        origin: 'own',
        source: null,
        source_item_id: null,
        based_on_food_id: 'c1',
        based_on: { id: 'c1', name: 'Arroz blanco' },
      }),
    )
    renderDetail('copy-1')
    expect(await screen.findByText(/Propio, basado en/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Arroz blanco' })).toHaveAttribute(
      'href',
      '/alimentos/c1',
    )
  })
})

describe('Búsqueda con copias', () => {
  it('distingue el alimento del catálogo de su copia', async () => {
    mockedSearch.mockResolvedValue([
      {
        id: 'c1',
        name: 'Arroz blanco',
        name_status: 'original',
        brand: null,
        reference_basis: '100g',
        energy_kcal: 130,
        origin: 'imported',
        based_on_food_id: null,
        source_name: 'USDA FoodData Central',
        total_estimate: 2,
      },
      {
        id: 'copy-1',
        name: 'Arroz blanco',
        name_status: 'original',
        brand: null,
        reference_basis: '100g',
        energy_kcal: 125,
        origin: 'own',
        based_on_food_id: 'c1',
        source_name: null,
        total_estimate: 2,
      },
    ])
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/alimentos?q=arroz']}>
          <Routes>
            <Route path="/alimentos" element={<FoodSearchPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(3))
    const list = screen.getByRole('list')
    expect(within(list).getByText(es.foods.originBadge.catalog)).toBeVisible()
    expect(within(list).getByText(es.foods.originBadge.copy)).toBeVisible()
  })
})
