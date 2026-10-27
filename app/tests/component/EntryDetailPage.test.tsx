// T042 (spec 003, FR-011, FR-013, FR-019 a FR-023): detalle de un ítem, corregirlo, moverlo y eliminarlo.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { fetchFood, type Food } from '../../src/features/foods/api'
import { deleteEntry, fetchEntry, updateEntry, type MealEntry } from '../../src/features/meals/api'
import { EntryDetailPage } from '../../src/features/meals/EntryDetailPage'
import { fetchProfile, type Profile } from '../../src/features/profile/api'
import { draftKey } from '../../src/lib/drafts'

vi.mock('../../src/features/meals/api', () => ({
  fetchEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
}))
vi.mock('../../src/features/foods/api', () => ({ fetchFood: vi.fn(), createFood: vi.fn() }))
vi.mock('../../src/features/profile/api', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))

const mockedFetch = vi.mocked(fetchEntry)
const mockedUpdate = vi.mocked(updateEntry)
const mockedDelete = vi.mocked(deleteEntry)

const signedIn: AuthState = {
  status: 'signedIn',
  session: { access_token: 'jwt', user: { id: 'u1' } } as never,
  expired: false,
  signOut: async () => {},
}

const profile: Profile = {
  user_id: 'u1',
  birth_date: null,
  sex: null,
  height_cm: null,
  timezone: 'America/Argentina/Buenos_Aires',
  unit_system: 'metric',
  onboarding_completed_at: '2026-10-20T00:00:00Z',
  goal_type: null,
  experience: null,
  job_activity: null,
  training_days: null,
  privacy_notice_version: '2026-10-16',
  privacy_notice_accepted_at: '2026-10-16T12:00:00Z',
  email_verified_at: null,
  last_active_at: '2026-10-19T12:00:00Z',
  created_at: '2026-10-16T12:00:00Z',
  updated_at: '2026-10-16T12:00:00Z',
}

function entry(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: 'e1',
    log_date: '2026-10-19',
    meal: 'lunch',
    origin: 'catalog',
    status: 'confirmed',
    food_id: 'f1',
    food_name: 'Arroz blanco',
    food_brand: 'Gallo',
    reference_basis: '100g',
    per100_energy_kcal: 130,
    per100_protein_g: 2.8,
    per100_carbs_g: 28,
    per100_sugars_g: null,
    per100_fat_g: 0.3,
    per100_saturated_fat_g: null,
    per100_fiber_g: null,
    per100_sodium_mg: 1,
    quantity: 150,
    portion_name: null,
    portion_quantity: null,
    portion_count: null,
    quantity_text: null,
    energy_kcal: 195,
    protein_g: 4.2,
    carbs_g: 42,
    sugars_g: null,
    fat_g: 0.45,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: 1.5,
    created_at: '2026-10-19T15:00:00Z',
    ...overrides,
  }
}

const manual = (overrides: Partial<MealEntry> = {}) =>
  entry({
    id: 'm1',
    origin: 'manual',
    food_id: null,
    food_name: 'Torta de cumpleaños',
    food_brand: null,
    reference_basis: null,
    per100_energy_kcal: null,
    per100_protein_g: null,
    per100_carbs_g: null,
    per100_fat_g: null,
    per100_sodium_mg: null,
    quantity: null,
    quantity_text: '1 porción',
    energy_kcal: 350,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    sodium_mg: null,
    ...overrides,
  })

const food: Food = {
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
  protein_g: 2.8,
  carbs_g: 28,
  sugars_g: null,
  fat_g: 0.3,
  saturated_fat_g: null,
  fiber_g: null,
  sodium_mg: 1,
  portions: [{ id: 'p1', name: '1 taza', quantity: 158, position: 0 }],
  source: { id: 's', slug: 'usda-fdc', name: 'USDA' },
  based_on: null,
}

function DayStub() {
  const location = useLocation()
  return <h1>Día {location.pathname}</h1>
}

function renderPage(id = 'e1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/comidas/item/${id}`]}>
          <Routes>
            <Route path="/comidas/:fecha" element={<DayStub />} />
            <Route path="/comidas/item/:id" element={<EntryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

const save = () => screen.getByRole('button', { name: es.meals.entry.save })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-19T15:00:00Z') })
  mockedFetch.mockReset().mockResolvedValue(entry())
  mockedUpdate.mockReset().mockResolvedValue('e1')
  mockedDelete.mockReset().mockResolvedValue(undefined)
  vi.mocked(fetchFood).mockReset().mockResolvedValue(food)
  vi.mocked(fetchProfile).mockReset().mockResolvedValue(profile)
})

afterEach(() => vi.useRealTimers())

describe('detalle (FR-012, FR-013)', () => {
  it('muestra el nombre, el origen, la cantidad y todos los valores con su unidad', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Arroz blanco' })).toBeVisible()
    expect(screen.getByText('Gallo')).toBeVisible()
    expect(screen.getByText(es.meals.origin.catalog)).toBeVisible()
    const values = screen.getByRole('table', { name: es.meals.entry.values })
    expect(within(values).getByRole('row', { name: /^Energía/ })).toHaveTextContent('195 kcal')
    expect(within(values).getByRole('row', { name: /^Sodio/ })).toHaveTextContent('1,5 mg')
    expect(within(values).getByRole('row', { name: /^Fibra/ })).toHaveTextContent('sin dato')
  })

  it('FR-013: si el alimento ya no existe lo indica y conserva los valores', async () => {
    mockedFetch.mockResolvedValue(entry({ food_id: null }))
    renderPage()
    expect(await screen.findByText(es.meals.day.foodGone)).toBeVisible()
    const values = screen.getByRole('table', { name: es.meals.entry.values })
    expect(within(values).getByRole('row', { name: /^Energía/ })).toHaveTextContent('195 kcal')
  })

  it('un ítem estimado y sin confirmar lleva su etiqueta y la nota', async () => {
    mockedFetch.mockResolvedValue(manual({ origin: 'estimated', status: 'pending' }))
    renderPage('m1')
    expect(await screen.findByText(es.meals.pending)).toBeVisible()
    expect(screen.getByText(es.meals.pendingNote)).toBeVisible()
  })

  it('un registro inexistente o ajeno dice "No encontramos este registro"', async () => {
    mockedFetch.mockResolvedValue(null)
    renderPage('otro')
    expect(await screen.findByText(es.meals.entry.notFound)).toBeVisible()
  })

  it('si falla la carga, avisa y permite reintentar', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(entry())
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.meals.entry.loadError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Arroz blanco' })).toBeVisible()
  })
})

describe('corregir la cantidad, la comida y el día (FR-019, FR-020)', () => {
  it('cambiar la cantidad envía solo la cantidad y confirma', async () => {
    renderPage()
    const field = await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.clear(field)
    await userEvent.type(field, '200')
    await userEvent.click(save())
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1))
    expect(mockedUpdate).toHaveBeenCalledWith('e1', { quantity: 200 })
    expect(await screen.findByText(es.meals.entry.saved)).toBeVisible()
  })

  it('sin cambios no envía nada y lo dice', async () => {
    renderPage()
    await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.click(save())
    expect(await screen.findByText(es.meals.entry.noChanges)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('mover a otra comida y a otro día envía solo eso', async () => {
    renderPage()
    await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.selectOptions(screen.getByLabelText(es.meals.entry.meal), 'dinner')
    fireEvent.change(screen.getByLabelText(es.meals.entry.day), { target: { value: '2026-10-18' } })
    await userEvent.click(save())
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedUpdate).toHaveBeenCalledWith('e1', { meal: 'dinner', log_date: '2026-10-18' })
  })

  it('una cantidad inválida se rechaza con un mensaje y no se envía', async () => {
    renderPage()
    const field = await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.clear(field)
    await userEvent.type(field, '0')
    await userEvent.click(save())
    expect(await screen.findByText(es.meals.errors.quantity)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('cambiar el número de porciones envía solo el número', async () => {
    mockedFetch.mockResolvedValue(
      entry({ portion_name: '1 taza', portion_quantity: 158, portion_count: 1.5, quantity: 237 }),
    )
    renderPage()
    const field = await screen.findByLabelText(es.meals.quantity.amountPortions)
    expect(field).toHaveValue('1,5')
    await userEvent.clear(field)
    await userEvent.type(field, '2')
    await userEvent.click(save())
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedUpdate).toHaveBeenCalledWith('e1', { portion_count: 2 })
  })

  it('pasar de porciones a gramos envía la cantidad en gramos', async () => {
    mockedFetch.mockResolvedValue(
      entry({ portion_name: '1 taza', portion_quantity: 158, portion_count: 1, quantity: 158 }),
    )
    renderPage()
    await screen.findByLabelText(es.meals.quantity.amountPortions)
    await userEvent.selectOptions(screen.getByLabelText(es.meals.quantity.measure), '')
    const field = screen.getByLabelText(es.meals.quantity.amountGrams)
    await userEvent.clear(field)
    await userEvent.type(field, '120')
    await userEvent.click(save())
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedUpdate).toHaveBeenCalledWith('e1', { quantity: 120 })
  })

  it('FR-037: un fallo de red conserva lo escrito y el borrador, y no da por guardado', async () => {
    mockedUpdate.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    const field = await screen.findByLabelText(es.meals.quantity.amountGrams)
    await userEvent.clear(field)
    await userEvent.type(field, '250')
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.queryByText(es.meals.entry.saved)).toBeNull()
    expect(screen.getByLabelText(es.meals.quantity.amountGrams)).toHaveValue('250')
    expect(localStorage.getItem(draftKey('u1', 'meal-edit-e1'))).toContain('250')
  })
})

describe('ítems manuales (FR-021, FR-023)', () => {
  it('se editan la descripción y los valores, enviando solo lo que cambió', async () => {
    mockedFetch.mockResolvedValue(manual())
    renderPage('m1')
    const description = await screen.findByLabelText(es.meals.manual.description)
    expect(description).toHaveValue('Torta de cumpleaños')
    await userEvent.clear(description)
    await userEvent.type(description, 'Torta de chocolate')
    const energy = screen.getByLabelText('Energía (kcal)', { exact: false })
    await userEvent.clear(energy)
    await userEvent.type(energy, '420')
    await userEvent.click(screen.getByRole('button', { name: es.meals.entry.save }))
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
    expect(mockedUpdate).toHaveBeenCalledWith('m1', {
      description: 'Torta de chocolate',
      energy_kcal: 420,
    })
  })

  it('FR-021: rechaza los mismos valores inválidos que al crear', async () => {
    mockedFetch.mockResolvedValue(manual())
    renderPage('m1')
    const energy = await screen.findByLabelText('Energía (kcal)', { exact: false })
    await userEvent.clear(energy)
    await userEvent.click(screen.getByRole('button', { name: es.meals.entry.save }))
    expect(await screen.findByText(es.meals.manual.errors.energyRequired)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('FR-023: un manual ofrece guardarlo como alimento propio y uno del catálogo no', async () => {
    mockedFetch.mockResolvedValue(manual())
    renderPage('m1')
    expect(await screen.findByRole('button', { name: es.meals.saveAsFood.action })).toBeVisible()
  })

  it('un ítem del catálogo no ofrece guardarlo como alimento propio', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Arroz blanco' })
    expect(screen.queryByRole('button', { name: es.meals.saveAsFood.action })).toBeNull()
  })
})

describe('eliminar (FR-022)', () => {
  it('pide confirmación accesible y Escape cancela sin eliminar', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: es.meals.entry.delete }))
    const dialog = await screen.findByRole('dialog', { name: es.meals.entry.deleteTitle })
    expect(dialog).toHaveTextContent(es.meals.entry.deleteBody)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('al confirmar elimina y vuelve al día', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: es.meals.entry.delete }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.entry.confirmDelete }))
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('e1'))
    expect(await screen.findByRole('heading', { name: 'Día /comidas/2026-10-19' })).toBeVisible()
  })

  it('si falla, avisa dentro del diálogo y no lo cierra', async () => {
    mockedDelete.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: es.meals.entry.delete }))
    await userEvent.click(await screen.findByRole('button', { name: es.meals.entry.confirmDelete }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.getByRole('dialog')).toBeVisible()
  })
})
