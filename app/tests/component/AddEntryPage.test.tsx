// T022 (spec 003, FR-001, FR-002, FR-009, FR-027, FR-037, FR-040): agregar un alimento a una comida.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import {
  catalogHasFoods,
  fetchFood,
  searchFoods,
  type Food,
  type FoodSummary,
} from '../../src/features/foods/api'
import { addEntry, fetchRecents, type RecentItem } from '../../src/features/meals/api'
import { AddEntryPage } from '../../src/features/meals/AddEntryPage'
import { draftKey } from '../../src/lib/drafts'

vi.mock('../../src/features/meals/api', () => ({ addEntry: vi.fn(), fetchRecents: vi.fn() }))
vi.mock('../../src/features/foods/api', () => ({
  searchFoods: vi.fn(),
  catalogHasFoods: vi.fn(),
  fetchFood: vi.fn(),
}))

const mockedAdd = vi.mocked(addEntry)
const mockedRecents = vi.mocked(fetchRecents)
const mockedSearch = vi.mocked(searchFoods)
const mockedFetchFood = vi.mocked(fetchFood)

const signedIn: AuthState = {
  status: 'signedIn',
  session: { access_token: 'jwt', user: { id: 'u1' } } as never,
  expired: false,
  signOut: async () => {},
}

function recent(overrides: Partial<RecentItem> = {}): RecentItem {
  return {
    food_id: 'f1',
    origin: 'catalog',
    food_name: 'Arroz blanco',
    food_brand: 'Gallo',
    reference_basis: '100g',
    quantity: 180,
    portion_id: null,
    portion_name: null,
    portion_count: null,
    quantity_text: null,
    energy_kcal: 234,
    protein_g: 4.9,
    carbs_g: 50,
    sugars_g: null,
    fat_g: 0.5,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: null,
    last_logged_at: '2026-10-18T12:00:00Z',
    ...overrides,
  }
}

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: 'f1',
    origin: 'imported',
    source_item_id: '1',
    imported_at: '2026-10-18T12:00:00Z',
    based_on_food_id: null,
    name: 'Arroz blanco',
    name_status: 'original',
    brand: 'Gallo',
    reference_basis: '100g',
    energy_kcal: 130,
    protein_g: 2.7,
    carbs_g: 28,
    sugars_g: null,
    fat_g: 0.3,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: null,
    portions: [{ id: 'p1', name: '1 taza', quantity: 158, position: 0 }],
    source: { id: 's', slug: 'usda-fdc', name: 'USDA' },
    based_on: null,
    ...overrides,
  }
}

function summary(overrides: Partial<FoodSummary> = {}): FoodSummary {
  return {
    id: 'f2',
    name: 'Mi pan',
    name_status: 'original',
    brand: null,
    reference_basis: '100g',
    energy_kcal: 250,
    origin: 'own',
    based_on_food_id: null,
    source_name: null,
    total_estimate: 1,
    ...overrides,
  }
}

function DayStub() {
  const location = useLocation()
  const added = (location.state as { added?: string } | null)?.added
  return (
    <div>
      <h1>Día {location.pathname}</h1>
      {added ? <p role="status">{added}</p> : null}
    </div>
  )
}

function renderPage(entry = '/comidas/2026-10-19/agregar?comida=lunch') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/comidas" element={<h1>Hoy</h1>} />
            <Route path="/comidas/:fecha" element={<DayStub />} />
            <Route path="/comidas/:fecha/agregar" element={<AddEntryPage />} />
            <Route path="/alimentos/nuevo" element={<h1>Crear alimento</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

const confirm = () => screen.getByRole('button', { name: es.meals.add.confirm })

beforeEach(() => {
  mockedAdd.mockReset().mockResolvedValue('entry-1')
  mockedRecents.mockReset().mockResolvedValue([recent()])
  mockedSearch.mockReset().mockResolvedValue([])
  vi.mocked(catalogHasFoods).mockReset().mockResolvedValue(true)
  mockedFetchFood.mockReset().mockResolvedValue(food())
})

describe('recientes (FR-040)', () => {
  it('registra un reciente con su última cantidad en 2 interacciones', async () => {
    renderPage()
    const item = await screen.findByRole('button', { name: /Arroz blanco/ })
    expect(within(item).getByText(/180 g/)).toBeVisible()

    await userEvent.click(item) // interacción 1: elegir el reciente
    expect(await screen.findByLabelText(es.meals.quantity.amountGrams)).toHaveValue('180')
    await userEvent.click(confirm()) // interacción 2: confirmar

    await waitFor(() => expect(mockedAdd).toHaveBeenCalledTimes(1))
    const [input, requestId] = mockedAdd.mock.calls[0]!
    expect(input).toEqual({ log_date: '2026-10-19', meal: 'lunch', food_id: 'f1', quantity: 180 })
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('un reciente con porción vuelve con la porción y el número de porciones', async () => {
    mockedRecents.mockResolvedValue([
      recent({ portion_id: 'p1', portion_name: '1 taza', portion_count: 1.5, quantity: 237 }),
    ])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    expect(await screen.findByLabelText(es.meals.quantity.amountPortions)).toHaveValue('1,5')
    await userEvent.click(confirm())
    await waitFor(() => expect(mockedAdd).toHaveBeenCalled())
    expect(mockedAdd.mock.calls[0]![0]).toEqual({
      log_date: '2026-10-19',
      meal: 'lunch',
      food_id: 'f1',
      portion_id: 'p1',
      portion_count: 1.5,
    })
  })

  it('sin recientes lo dice y deja buscar', async () => {
    mockedRecents.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(es.meals.add.recentsEmpty)).toBeVisible()
    expect(screen.getByRole('searchbox', { name: es.meals.add.search })).toBeVisible()
  })
})

describe('búsqueda y cantidad (FR-001, FR-002)', () => {
  it('busca con la búsqueda de alimentos, incluye los propios y abre el selector de cantidad', async () => {
    mockedSearch.mockResolvedValue([summary()])
    mockedFetchFood.mockResolvedValue(
      food({ id: 'f2', name: 'Mi pan', origin: 'own', brand: null, portions: [] }),
    )
    renderPage()
    await userEvent.type(await screen.findByRole('searchbox', { name: es.meals.add.search }), 'pan')

    const result = await screen.findByRole('button', { name: /Mi pan/ })
    expect(within(result).getByText(es.meals.origin.own)).toBeVisible()
    await userEvent.click(result)

    await waitFor(() => expect(mockedFetchFood).toHaveBeenCalledWith('f2'))
    const amount = await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.clear(amount)
    await userEvent.type(amount, '60')
    await userEvent.click(confirm())
    await waitFor(() => expect(mockedAdd).toHaveBeenCalled())
    expect(mockedAdd.mock.calls[0]![0]).toMatchObject({ food_id: 'f2', quantity: 60 })
  })

  it('FR-003: una cantidad inválida se rechaza con un mensaje y no se envía', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    const amount = await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.clear(amount)
    await userEvent.type(amount, '0')
    await userEvent.click(confirm())
    expect(await screen.findByText(es.meals.errors.quantity)).toBeVisible()
    expect(mockedAdd).not.toHaveBeenCalled()
  })

  it('la comida de destino viene de ?comida= y se puede cambiar', async () => {
    renderPage('/comidas/2026-10-19/agregar?comida=dinner')
    expect(await screen.findByRole('radio', { name: es.meals.names.dinner })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: es.meals.names.snack }))
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.confirm }))
    await waitFor(() => expect(mockedAdd).toHaveBeenCalled())
    expect(mockedAdd.mock.calls[0]![0]).toMatchObject({ meal: 'snack' })
  })

  it('FR-027: se puede registrar en un día pasado y dice en qué día se registrará', async () => {
    renderPage('/comidas/2020-01-15/agregar?comida=lunch')
    expect(await screen.findByText(es.meals.add.destination('miércoles 15 de enero'))).toBeVisible()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.confirm }))
    await waitFor(() => expect(mockedAdd).toHaveBeenCalled())
    expect(mockedAdd.mock.calls[0]![0]).toMatchObject({ log_date: '2020-01-15' })
  })

  it('una fecha inválida muestra un aviso con un enlace a hoy', async () => {
    renderPage('/comidas/2026-02-30/agregar?comida=lunch')
    expect(await screen.findByText(es.meals.day.invalidDate)).toBeVisible()
    expect(screen.getByRole('link', { name: es.meals.day.goToday })).toHaveAttribute(
      'href',
      '/comidas',
    )
  })
})

describe('guardado confirmado (FR-009, FR-037)', () => {
  it('el éxito vuelve al día con el aviso de lo agregado', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.confirm }))
    expect(await screen.findByRole('heading', { name: 'Día /comidas/2026-10-19' })).toBeVisible()
    expect(screen.getByText(es.meals.addedTo.lunch)).toBeVisible()
    expect(localStorage.getItem(draftKey('u1', 'meal-add-2026-10-19-lunch'))).toBeNull()
  })

  it('FR-009: el doble clic envía una sola vez', async () => {
    let resolve: (id: string) => void = () => {}
    mockedAdd.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await userEvent.dblClick(await screen.findByRole('button', { name: es.meals.add.confirm }))
    expect(mockedAdd).toHaveBeenCalledTimes(1)
    resolve('entry-1')
    expect(await screen.findByRole('heading', { name: /Día/ })).toBeVisible()
  })

  it('un reintento tras un fallo usa el mismo identificador de solicitud', async () => {
    mockedAdd.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('entry-1')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.confirm }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    await userEvent.click(screen.getByRole('button', { name: es.meals.add.confirm }))
    await waitFor(() => expect(mockedAdd).toHaveBeenCalledTimes(2))
    expect(mockedAdd.mock.calls[0]![1]).toBe(mockedAdd.mock.calls[1]![1])
  })

  it('un fallo de red conserva lo elegido y el borrador, y no da por agregado', async () => {
    mockedAdd.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.confirm }))

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.getByLabelText(es.meals.quantity.amountGrams)).toHaveValue('180')
    expect(screen.queryByText(es.meals.addedTo.lunch)).toBeNull()
    expect(localStorage.getItem(draftKey('u1', 'meal-add-2026-10-19-lunch'))).toContain('f1')
  })

  it('si el alimento se eliminó mientras se completaba, lo dice y conserva el borrador', async () => {
    mockedAdd.mockRejectedValue({ message: 'not_found: el alimento no existe', code: 'P0002' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.confirm }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.meals.errors.foodGone)
    expect(localStorage.getItem(draftKey('u1', 'meal-add-2026-10-19-lunch'))).not.toBeNull()
  })
})

describe('borrador (FR-037)', () => {
  it('recupera lo que se estaba agregando y permite descartarlo', async () => {
    localStorage.setItem(
      draftKey('u1', 'meal-add-2026-10-19-lunch'),
      JSON.stringify({ savedAt: Date.now(), values: { foodId: 'f1', portion: '', amount: '250' } }),
    )
    renderPage()
    expect(await screen.findByLabelText(es.meals.quantity.amountGrams)).toHaveValue('250')
    expect(screen.getByText(es.meals.add.draftRestored)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.meals.add.draftDiscard }))
    expect(screen.queryByLabelText(es.meals.quantity.amountGrams)).toBeNull()
    expect(localStorage.getItem(draftKey('u1', 'meal-add-2026-10-19-lunch'))).toBeNull()
  })

  it('"Elegir otro alimento" vuelve a la lista y descarta el borrador', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Arroz blanco/ }))
    await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.click(screen.getByRole('button', { name: es.meals.add.chooseOther }))
    expect(await screen.findByRole('button', { name: /Arroz blanco/ })).toBeVisible()
    expect(localStorage.getItem(draftKey('u1', 'meal-add-2026-10-19-lunch'))).toBeNull()
  })
})

describe('entrada manual (FR-006)', () => {
  it('"Escribir a mano" abre el formulario de entrada manual y permite volver', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.manual }))
    expect(await screen.findByRole('heading', { name: es.meals.manual.title })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.meals.manual.back }))
    expect(await screen.findByRole('button', { name: es.meals.add.manual })).toBeVisible()
  })

  it('un reciente manual se vuelve a registrar con sus valores en el formulario', async () => {
    mockedRecents.mockResolvedValue([
      recent({
        food_id: null,
        origin: 'manual',
        food_name: 'Torta de cumpleaños',
        food_brand: null,
        reference_basis: null,
        quantity: null,
        quantity_text: '1 porción',
        energy_kcal: 380,
        protein_g: null,
      }),
    ])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Torta de cumpleaños/ }))
    expect(await screen.findByLabelText(es.meals.manual.description)).toHaveValue(
      'Torta de cumpleaños',
    )
    expect(screen.getByLabelText(es.meals.manual.quantityText)).toHaveValue('1 porción')
    expect(screen.getByLabelText('Energía (kcal)', { exact: false })).toHaveValue('380')
    expect(screen.getByLabelText('Proteínas (g)', { exact: false })).toHaveValue('')
  })

  it('un borrador manual se recupera al abrir la pantalla', async () => {
    localStorage.setItem(
      draftKey('u1', 'meal-manual-2026-10-19-lunch'),
      JSON.stringify({
        savedAt: Date.now(),
        values: {
          description: 'Sin terminar',
          quantity_text: '',
          energy_kcal: '120',
          protein_g: '',
          carbs_g: '',
          sugars_g: '',
          fat_g: '',
          saturated_fat_g: '',
          fiber_g: '',
          sodium_mg: '',
        },
      }),
    )
    renderPage()
    expect(await screen.findByLabelText(es.meals.manual.description)).toHaveValue('Sin terminar')
    expect(screen.getByText(es.meals.manual.draftRestored)).toBeVisible()
  })

  it('al guardar un ítem manual vuelve al día con el aviso de lo agregado', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: es.meals.add.manual }))
    await userEvent.type(await screen.findByLabelText(es.meals.manual.description), 'Torta')
    await userEvent.type(screen.getByLabelText('Energía (kcal)', { exact: false }), '350')
    await userEvent.click(screen.getByRole('button', { name: es.meals.manual.save }))
    expect(await screen.findByText(es.meals.addedTo.lunch)).toBeVisible()
    expect(mockedAdd.mock.calls[0]![0]).toMatchObject({
      origin: 'manual',
      description: 'Torta',
      meal: 'lunch',
    })
  })
})
