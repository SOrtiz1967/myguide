// T021 (spec 002, FR-005 a FR-007, FR-011): detalle de un alimento.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchFood, type Food } from '../../src/features/foods/api'
import { FoodDetailPage } from '../../src/features/foods/FoodDetailPage'

vi.mock('../../src/features/foods/api', () => ({ fetchFood: vi.fn() }))

const mockedFetch = vi.mocked(fetchFood)

function catalogFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'c1',
    origin: 'imported',
    source_item_id: '170393',
    imported_at: '2026-10-18T12:00:00Z',
    based_on_food_id: null,
    name: 'Arroz blanco cocido',
    name_status: 'original',
    brand: null,
    reference_basis: '100g',
    energy_kcal: 62,
    protein_g: 3.3,
    carbs_g: 12,
    sugars_g: 1,
    fat_g: 0.5,
    saturated_fat_g: 0.1,
    fiber_g: 0.4,
    sodium_mg: 1250,
    portions: [],
    source: { id: 's1', slug: 'usda-fdc', name: 'USDA FoodData Central' },
    based_on: null,
    ...overrides,
  }
}

function ownFood(overrides: Partial<Food> = {}): Food {
  return catalogFood({
    id: 'o1',
    origin: 'own',
    source_item_id: null,
    imported_at: null,
    source: null,
    name: 'Mi arroz',
    ...overrides,
  })
}

function renderPage(id = 'c1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/alimentos/${id}`]}>
        <Routes>
          <Route path="/alimentos" element={<h1>Búsqueda</h1>} />
          <Route path="/alimentos/:id" element={<FoodDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const row = (label: string) => screen.getByRole('row', { name: new RegExp(`^${label}`) })

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(catalogFood())
})

describe('FoodDetailPage: valores nutricionales (FR-005, FR-006)', () => {
  it('muestra cada valor con su unidad y la base de referencia', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Arroz blanco cocido' })).toBeVisible()
    expect(screen.getByText(/por 100 g/)).toBeVisible()
    expect(within(row('Energía')).getByText('62 kcal')).toBeVisible()
    expect(within(row('Proteínas')).getByText('3,3 g')).toBeVisible()
    expect(within(row('Carbohidratos')).getByText('12 g')).toBeVisible()
    expect(within(row('de los cuales azúcares')).getByText('1 g')).toBeVisible()
    expect(within(row('Grasas totales')).getByText('0,5 g')).toBeVisible()
    expect(within(row('de las cuales saturadas')).getByText('0,1 g')).toBeVisible()
    expect(within(row('Fibra')).getByText('0,4 g')).toBeVisible()
    expect(within(row('Sodio')).getByText('1.250 mg')).toBeVisible()
  })

  it('nombra la base "por 100 ml" para los líquidos', async () => {
    mockedFetch.mockResolvedValue(catalogFood({ reference_basis: '100ml', name: 'Leche' }))
    renderPage()
    expect(await screen.findByText(/por 100 ml/)).toBeVisible()
  })

  it('un valor que falta es "sin dato" y nunca 0', async () => {
    mockedFetch.mockResolvedValue(catalogFood({ fiber_g: null, sodium_mg: null }))
    renderPage()
    await screen.findByRole('heading', { name: 'Arroz blanco cocido' })
    expect(within(row('Fibra')).getByText('sin dato')).toBeVisible()
    expect(within(row('Sodio')).getByText('sin dato')).toBeVisible()
    expect(within(row('Fibra')).queryByText(/0/)).toBeNull()
  })

  it('un cero real se muestra como cero', async () => {
    mockedFetch.mockResolvedValue(catalogFood({ sugars_g: 0 }))
    renderPage()
    await screen.findByRole('heading', { name: 'Arroz blanco cocido' })
    expect(within(row('de los cuales azúcares')).getByText('0 g')).toBeVisible()
  })
})

describe('FoodDetailPage: porciones (FR-007)', () => {
  it('muestra las porciones aparte, con su cantidad y unidad', async () => {
    mockedFetch.mockResolvedValue(
      catalogFood({
        portions: [
          { id: 'p1', name: 'Taza', quantity: 158, position: 0 },
          { id: 'p2', name: 'Cucharada', quantity: 12.5, position: 1 },
        ],
      }),
    )
    renderPage()
    const section = (await screen.findByRole('heading', { name: es.foods.portions.title })).closest(
      'section',
    )!
    expect(within(section).getByText('Taza: 158 g')).toBeVisible()
    expect(within(section).getByText('Cucharada: 12,5 g')).toBeVisible()
  })

  it('un alimento sin porciones dice "Sin porciones"', async () => {
    renderPage()
    expect(await screen.findByText(es.foods.portions.none)).toBeVisible()
  })

  it('las porciones de un líquido van en mililitros', async () => {
    mockedFetch.mockResolvedValue(
      catalogFood({
        reference_basis: '100ml',
        portions: [{ id: 'p1', name: 'Vaso', quantity: 200, position: 0 }],
      }),
    )
    renderPage()
    expect(await screen.findByText('Vaso: 200 ml')).toBeVisible()
  })
})

describe('FoodDetailPage: procedencia (FR-011)', () => {
  it('un alimento del catálogo muestra fuente, código y fecha de importación', async () => {
    renderPage()
    expect(
      await screen.findByText(
        'Del catálogo · USDA FoodData Central · código 170393 · importado el 18/10/2026',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: es.foods.provenance.viewSources })).toHaveAttribute(
      'href',
      '/fuentes',
    )
  })

  it('un alimento propio dice "Propio"', async () => {
    mockedFetch.mockResolvedValue(ownFood())
    renderPage('o1')
    const section = (
      await screen.findByRole('heading', { name: es.foods.provenance.title })
    ).closest('section')!
    expect(within(section).getByText('Propio')).toBeVisible()
  })

  it('una copia dice de qué alimento se basa y enlaza al original', async () => {
    mockedFetch.mockResolvedValue(
      ownFood({ based_on_food_id: 'c1', based_on: { id: 'c1', name: 'Arroz blanco cocido' } }),
    )
    renderPage('o1')
    expect(await screen.findByText(/Propio, basado en/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Arroz blanco cocido' })).toHaveAttribute(
      'href',
      '/alimentos/c1',
    )
  })

  it('FR-014: marca la traducción sin revisar y no marca las demás', async () => {
    mockedFetch.mockResolvedValue(catalogFood({ name_status: 'machine_translated' }))
    renderPage()
    expect(await screen.findByText(es.foods.nameStatus.machine_translated)).toBeVisible()
  })

  it('FR-014: un nombre original o revisado no lleva la etiqueta de traducción sin revisar', async () => {
    mockedFetch.mockResolvedValue(catalogFood({ name_status: 'reviewed' }))
    renderPage()
    await screen.findByRole('heading', { name: 'Arroz blanco cocido' })
    expect(screen.queryByText(es.foods.nameStatus.machine_translated)).toBeNull()
  })
})

describe('FoodDetailPage: estados y acciones', () => {
  it('un nombre largo se muestra completo en el detalle', async () => {
    const long =
      'Galletitas "súper" <crocantes> 🍪 con chips de chocolate y dulce de leche '.repeat(3)
    mockedFetch.mockResolvedValue(catalogFood({ name: long.trim() }))
    renderPage()
    expect(await screen.findByRole('heading', { name: long.trim() })).toBeVisible()
  })

  it('tras guardar, confirma "Alimento guardado"', async () => {
    mockedFetch.mockResolvedValue(ownFood())
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[{ pathname: '/alimentos/o1', state: { saved: true } }]}>
          <Routes>
            <Route path="/alimentos/:id" element={<FoodDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText(es.foods.form.saved)).toBeVisible()
  })

  it('un alimento inexistente o ajeno dice "No encontramos este alimento"', async () => {
    mockedFetch.mockResolvedValue(null)
    renderPage('otro')
    expect(await screen.findByText(es.foods.notFound)).toBeVisible()
    expect(screen.getByRole('link', { name: es.foods.backToSearch })).toHaveAttribute(
      'href',
      '/alimentos',
    )
  })

  it('muestra la carga y, si falla, permite reintentar', async () => {
    mockedFetch.mockReturnValueOnce(new Promise(() => {}))
    const first = renderPage()
    expect(await screen.findByRole('status')).toBeVisible()
    first.unmount()

    mockedFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(catalogFood())
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.foods.detailError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('heading', { name: 'Arroz blanco cocido' })).toBeVisible()
  })

  it('un alimento del catálogo ofrece "Crear mi versión" y no Editar ni Eliminar', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: es.foods.actions.createMine })).toBeVisible()
    expect(screen.queryByRole('link', { name: es.foods.actions.edit })).toBeNull()
    expect(screen.queryByRole('button', { name: es.foods.actions.delete })).toBeNull()
  })

  it('un alimento propio ofrece Editar, Eliminar y Crear una copia', async () => {
    mockedFetch.mockResolvedValue(ownFood())
    renderPage('o1')
    expect(await screen.findByRole('link', { name: es.foods.actions.edit })).toHaveAttribute(
      'href',
      '/alimentos/o1/editar',
    )
    expect(screen.getByRole('button', { name: es.foods.actions.delete })).toBeVisible()
    expect(screen.getByRole('button', { name: es.foods.actions.copy })).toBeVisible()
    expect(screen.queryByRole('button', { name: es.foods.actions.createMine })).toBeNull()
  })
})
