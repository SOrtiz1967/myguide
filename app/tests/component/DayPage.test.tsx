// T031 (spec 003, FR-012 a FR-018): la vista del día con sus comidas, subtotales y totales.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchDayEntries, type MealEntry } from '../../src/features/meals/api'
import { DayPage } from '../../src/features/meals/DayPage'
import { fetchProfile, type Profile } from '../../src/features/profile/api'

vi.mock('../../src/features/meals/api', () => ({ fetchDayEntries: vi.fn() }))
vi.mock('../../src/features/profile/api', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))

const mockedDay = vi.mocked(fetchDayEntries)

const profile: Profile = {
  user_id: 'u1',
  birth_date: null,
  sex: null,
  height_cm: null,
  timezone: 'America/Argentina/Buenos_Aires',
  unit_system: 'metric',
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
    per100_protein_g: 2.7,
    per100_carbs_g: 28,
    per100_sugars_g: null,
    per100_fat_g: 0.3,
    per100_saturated_fat_g: null,
    per100_fiber_g: null,
    per100_sodium_mg: null,
    quantity: 150,
    portion_name: null,
    portion_quantity: null,
    portion_count: null,
    quantity_text: null,
    energy_kcal: 195,
    protein_g: 4.05,
    carbs_g: 42,
    sugars_g: null,
    fat_g: 0.45,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: null,
    created_at: '2026-10-19T15:00:00Z',
    ...overrides,
  }
}

function renderDay(path = '/comidas/2026-10-19', state?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
          <Route path="/comidas" element={<h1>Hoy</h1>} />
          <Route path="/comidas/:fecha" element={<DayPage />} />
          <Route path="/comidas/:fecha/agregar" element={<h1>Agregar</h1>} />
          <Route path="/comidas/item/:id" element={<h1>Detalle</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const section = async (name: string) =>
  (await screen.findByRole('heading', { level: 2, name })).closest('section') as HTMLElement

beforeEach(() => {
  // Solo se simula la fecha: "hoy" es el 19/10/2026 en Buenos Aires.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-19T15:00:00Z') })
  mockedDay.mockReset().mockResolvedValue([])
  vi.mocked(fetchProfile).mockReset().mockResolvedValue(profile)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DayPage: comidas, subtotales y total (FR-014, FR-015, FR-016)', () => {
  it('muestra las cinco comidas en orden, cada una con su botón para agregar', async () => {
    renderDay()
    await screen.findByRole('heading', { level: 2, name: 'Desayuno' })
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titles.filter((t) => Object.values(es.meals.names).includes(t as never))).toEqual([
      'Desayuno',
      'Almuerzo',
      'Merienda',
      'Cena',
      'Colación',
    ])
    expect(screen.getByRole('link', { name: es.meals.day.addTo('Cena') })).toHaveAttribute(
      'href',
      '/comidas/2026-10-19/agregar?comida=dinner',
    )
  })

  it('cada ítem va en su comida con nombre, marca, cantidad, energía y origen', async () => {
    mockedDay.mockResolvedValue([
      entry(),
      entry({
        id: 'e2',
        meal: 'breakfast',
        origin: 'own',
        food_name: 'Mi pan',
        food_brand: null,
        quantity: 60,
        energy_kcal: 150,
      }),
    ])
    renderDay()
    const lunch = await section('Almuerzo')
    expect(await within(lunch).findByText('Arroz blanco')).toBeVisible()
    expect(within(lunch).getByText('Gallo')).toBeVisible()
    const row = within(lunch).getByRole('link', { name: /Arroz blanco/ })
    expect(within(row).getByText(/150 g/)).toBeVisible()
    expect(within(row).getByText(/195 kcal/)).toBeVisible()
    expect(within(lunch).getByText(es.meals.origin.catalog)).toBeVisible()
    const breakfast = await section('Desayuno')
    expect(within(breakfast).getByText('Mi pan')).toBeVisible()
    expect(within(breakfast).getByText(es.meals.origin.own)).toBeVisible()
    expect(within(lunch).queryByText('Mi pan')).toBeNull()
  })

  it('una porción se muestra con su número y la cantidad equivalente', async () => {
    mockedDay.mockResolvedValue([
      entry({ portion_name: '1 taza', portion_quantity: 158, portion_count: 1.5, quantity: 237 }),
    ])
    renderDay()
    expect(await screen.findByText(/1,5 × 1 taza \(237 g\)/)).toBeVisible()
  })

  it('subtotal por comida y total del día, con unidades', async () => {
    mockedDay.mockResolvedValue([
      entry(),
      entry({ id: 'e2', meal: 'dinner', energy_kcal: 300, protein_g: 20, carbs_g: 10, fat_g: 15 }),
    ])
    renderDay()
    const lunch = await screen.findByRole('heading', { level: 2, name: 'Almuerzo' })
    const subtotal = within(lunch.closest('section') as HTMLElement).getByLabelText(
      es.meals.day.subtotal,
    )
    expect(subtotal).toHaveTextContent('195 kcal')
    const total = screen.getByRole('region', { name: es.meals.day.total })
    expect(total).toHaveTextContent('495 kcal')
    expect(total).toHaveTextContent('24,1 g') // proteínas 4,05 + 20
  })

  it('FR-015: un nutriente que falta en algún ítem marca el total como incompleto', async () => {
    mockedDay.mockResolvedValue([
      entry(),
      entry({ id: 'e2', meal: 'dinner', fat_g: null, energy_kcal: 100 }),
    ])
    renderDay()
    const total = await screen.findByRole('region', { name: es.meals.day.total })
    expect(total).toHaveTextContent('al menos 0,5 g · falta en 1 ítem')
    expect(total).toHaveTextContent('295 kcal')
  })

  it('FR-005: la energía sin dato de un ítem se muestra como "sin dato", no como 0', async () => {
    mockedDay.mockResolvedValue([entry({ energy_kcal: null })])
    renderDay()
    const lunch = await screen.findByRole('heading', { level: 2, name: 'Almuerzo' })
    expect(
      within(lunch.closest('section') as HTMLElement).getAllByText(/sin dato/).length,
    ).toBeGreaterThan(0)
  })

  it('un ítem manual muestra su cantidad descriptiva y el origen "Manual"', async () => {
    mockedDay.mockResolvedValue([
      entry({
        origin: 'manual',
        food_id: null,
        food_name: 'Torta de cumpleaños',
        food_brand: null,
        quantity: null,
        quantity_text: '1 porción',
        energy_kcal: 350,
      }),
    ])
    renderDay()
    const lunch = await screen.findByRole('heading', { level: 2, name: 'Almuerzo' })
    const area = within(lunch.closest('section') as HTMLElement)
    expect(area.getByText('Torta de cumpleaños')).toBeVisible()
    expect(area.getByText(/1 porción/)).toBeVisible()
    expect(area.getByText(es.meals.origin.manual)).toBeVisible()
  })

  it('FR-013: si el alimento ya no existe lo indica y conserva los valores registrados', async () => {
    mockedDay.mockResolvedValue([entry({ food_id: null })])
    renderDay()
    expect(await screen.findByText(es.meals.day.foodGone)).toBeVisible()
    const row = screen.getByRole('link', { name: /Arroz blanco/ })
    expect(within(row).getByText(/195 kcal/)).toBeVisible()
  })

  it('FR-012: un ítem estimado sin confirmar lleva su etiqueta y la nota de posibles errores', async () => {
    mockedDay.mockResolvedValue([entry({ origin: 'estimated', status: 'pending', food_id: null })])
    renderDay()
    expect(await screen.findByText(es.meals.pending)).toBeVisible()
    expect(screen.getByText(es.meals.pendingNote)).toBeVisible()
  })

  it('el ítem enlaza a su detalle', async () => {
    mockedDay.mockResolvedValue([entry()])
    renderDay()
    const link = await screen.findByRole('link', { name: /Arroz blanco/ })
    expect(link).toHaveAttribute('href', '/comidas/item/e1')
  })

  it('FR-018: un día sin registros muestra el estado vacío', async () => {
    renderDay()
    expect(await screen.findByText(es.meals.day.empty)).toBeVisible()
    expect(screen.getAllByText(es.meals.day.mealEmpty)).toHaveLength(5)
  })

  it('tras agregar, avisa lo que se agregó', async () => {
    renderDay('/comidas/2026-10-19', { added: es.meals.addedTo.lunch })
    expect(await screen.findByText(es.meals.addedTo.lunch)).toBeVisible()
  })
})

describe('DayPage: navegación entre días (FR-017)', () => {
  it('ir al día anterior y al siguiente, con etiquetas que dicen a qué día', async () => {
    renderDay()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: es.meals.day.previous('domingo 18') })).toHaveAttribute(
      'href',
      '/comidas/2026-10-18',
    )
    expect(screen.getByRole('link', { name: es.meals.day.next('martes 20') })).toHaveAttribute(
      'href',
      '/comidas/2026-10-20',
    )
  })

  it('el título dice qué día es y si es hoy', async () => {
    renderDay()
    const title = await screen.findByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('lunes 19 de octubre')
    expect(title).toHaveTextContent(es.meals.day.today)
  })

  it('en otro día aparece el enlace para volver a hoy', async () => {
    renderDay('/comidas/2026-10-15')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: es.meals.day.today })).toHaveAttribute(
      'href',
      '/comidas/2026-10-19',
    )
  })

  it('elegir una fecha lleva a ese día', async () => {
    renderDay()
    await screen.findByRole('heading', { level: 1 })
    const picker = screen.getByLabelText(es.meals.day.pickDate)
    expect(picker).toHaveValue('2026-10-19')
    fireEvent.change(picker, { target: { value: '2026-10-15' } })
    expect(
      await screen.findByRole('heading', { level: 1, name: /jueves 15 de octubre/ }),
    ).toBeVisible()
  })

  it('no se puede ir más allá de 7 días después de hoy', async () => {
    renderDay('/comidas/2026-10-26')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: es.meals.day.next('martes 27') })).toBeNull()
  })

  it('una fecha inválida o fuera de rango muestra un aviso con un enlace a hoy', async () => {
    renderDay('/comidas/2026-02-30')
    expect(await screen.findByText(es.meals.day.invalidDate)).toBeVisible()
    expect(screen.getByRole('link', { name: es.meals.day.goToday })).toHaveAttribute(
      'href',
      '/comidas',
    )
  })

  it('más de 7 días en el futuro también se rechaza', async () => {
    renderDay('/comidas/2026-10-27')
    expect(await screen.findByText(es.meals.day.invalidDate)).toBeVisible()
  })
})

describe('DayPage: estados (FR-038)', () => {
  it('muestra la carga', async () => {
    mockedDay.mockReturnValue(new Promise(() => {}))
    renderDay()
    expect(await screen.findByText(es.meals.day.loading)).toBeVisible()
  })

  it('si falla, avisa y permite reintentar', async () => {
    mockedDay.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([entry()])
    renderDay()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.meals.day.loadError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByText('Arroz blanco')).toBeVisible()
  })

  it('un fallo de red lo dice', async () => {
    mockedDay.mockRejectedValue(new TypeError('Failed to fetch'))
    renderDay()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.meals.day.offlineLoad)
  })
})
