// T040 (spec 003, FR-023, escenario 12): guardar un ítem manual como alimento propio.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { createFood } from '../../src/features/foods/api'
import { SaveAsFoodPanel } from '../../src/features/meals/SaveAsFoodPanel'

vi.mock('../../src/features/foods/api', () => ({ createFood: vi.fn() }))
const mockedCreate = vi.mocked(createFood)

const entry = {
  food_name: 'Torta de cumpleaños',
  quantity_text: '1 porción' as string | null,
  energy_kcal: 350 as number | null,
  protein_g: 6 as number | null,
  carbs_g: 48 as number | null,
  sugars_g: null,
  fat_g: 15 as number | null,
  saturated_fat_g: null,
  fiber_g: null,
  sodium_mg: null,
}

function renderPanel(overrides: Partial<typeof entry> = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SaveAsFoodPanel entry={{ ...entry, ...overrides }} onClose={onClose} onSaved={onSaved} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onClose, onSaved }
}

const amount = () => screen.getByLabelText(es.meals.saveAsFood.amountGrams)
const save = () => screen.getByRole('button', { name: es.meals.saveAsFood.save })

beforeEach(() => {
  mockedCreate.mockReset().mockResolvedValue('food-1')
})

describe('SaveAsFoodPanel', () => {
  it('explica que los valores son de toda la cantidad y pide cuánto pesa o mide', () => {
    renderPanel()
    expect(screen.getByText(es.meals.saveAsFood.intro)).toBeVisible()
    expect(amount()).toBeVisible()
  })

  it('previsualiza los valores por 100 g con la cantidad indicada', async () => {
    renderPanel()
    await userEvent.type(amount(), '120')
    const preview = screen.getByRole('table', { name: /por 100 g/ })
    expect(within(preview).getByRole('row', { name: /^Energía/ })).toHaveTextContent('292 kcal')
    expect(within(preview).getByRole('row', { name: /^Fibra/ })).toHaveTextContent('sin dato')
  })

  it('crea el alimento propio con una porción y avisa dónde quedó', async () => {
    const { onSaved } = renderPanel()
    await userEvent.type(amount(), '120')
    await userEvent.click(save())

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1))
    const [payload, requestId] = mockedCreate.mock.calls[0]!
    expect(payload).toMatchObject({
      name: 'Torta de cumpleaños',
      reference_basis: '100g',
      energy_kcal: 291.67,
      protein_g: 5,
      fiber_g: null,
      portions: [{ name: '1 porción', quantity: 120 }],
    })
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByText(es.meals.saveAsFood.saved)).toBeVisible()
    expect(screen.getByRole('link', { name: es.meals.saveAsFood.viewFood })).toHaveAttribute(
      'href',
      '/alimentos/food-1',
    )
    expect(onSaved).toHaveBeenCalledWith('food-1')
  })

  it('para un líquido se mide en mililitros', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('radio', { name: es.meals.saveAsFood.milliliters }))
    await userEvent.type(screen.getByLabelText(es.meals.saveAsFood.amountMilliliters), '200')
    await userEvent.click(save())
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
    expect(mockedCreate.mock.calls[0]![0]).toMatchObject({
      reference_basis: '100ml',
      energy_kcal: 175,
    })
  })

  it('sin la cantidad que representa pide completarla y no crea nada', async () => {
    renderPanel()
    await userEvent.click(save())
    expect(await screen.findByText(es.meals.saveAsFood.errors.amount)).toBeVisible()
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('con valores imposibles por 100 g lo dice con el campo y no crea nada', async () => {
    renderPanel({ energy_kcal: 5000, protein_g: null, carbs_g: null, fat_g: null })
    await userEvent.type(amount(), '100')
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      `Energía: ${es.foods.errors.outOfRange('900')}`,
    )
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('el doble clic crea un solo alimento', async () => {
    let resolve: (id: string) => void = () => {}
    mockedCreate.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderPanel()
    await userEvent.type(amount(), '120')
    await userEvent.dblClick(save())
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    resolve('food-1')
    expect(await screen.findByText(es.meals.saveAsFood.saved)).toBeVisible()
  })

  it('un fallo de red no da por guardado y permite reintentar con el mismo identificador', async () => {
    mockedCreate.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('food-1')
    const { onSaved } = renderPanel()
    await userEvent.type(amount(), '120')
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(onSaved).not.toHaveBeenCalled()
    await userEvent.click(save())
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(mockedCreate.mock.calls[0]![1]).toBe(mockedCreate.mock.calls[1]![1])
  })

  it('"Cancelar" cierra el panel', async () => {
    const { onClose } = renderPanel()
    await userEvent.click(screen.getByRole('button', { name: es.meals.saveAsFood.cancel }))
    expect(onClose).toHaveBeenCalled()
  })
})
