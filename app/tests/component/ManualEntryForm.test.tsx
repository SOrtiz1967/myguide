// T037 (spec 003, FR-006, FR-007, FR-009, FR-037): entrada manual de lo que se comió.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { addEntry } from '../../src/features/meals/api'
import { ManualEntryForm } from '../../src/features/meals/ManualEntryForm'
import { emptyManualForm, type ManualFormInput } from '../../src/features/meals/schema'
import { draftKey } from '../../src/lib/drafts'

vi.mock('../../src/features/meals/api', () => ({ addEntry: vi.fn() }))
const mockedAdd = vi.mocked(addEntry)

const DRAFT = 'meal-manual-2026-10-19-extra'
const label = (text: string) => screen.getByLabelText(text, { exact: false })

function renderForm(initial?: ManualFormInput) {
  const onAdded = vi.fn()
  const onCancel = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ManualEntryForm
        userId="u1"
        date="2026-10-19"
        meal="extra"
        draftId={DRAFT}
        initial={initial}
        onCancel={onCancel}
        onAdded={onAdded}
      />
    </QueryClientProvider>,
  )
  return { onAdded, onCancel }
}

const save = () => screen.getByRole('button', { name: es.meals.manual.save })

beforeEach(() => {
  mockedAdd.mockReset().mockResolvedValue('entry-1')
})

describe('ManualEntryForm', () => {
  it('FR-006: crea con solo descripción y energía; lo demás queda sin dato', async () => {
    const { onAdded } = renderForm()
    await userEvent.type(label(es.meals.manual.description), 'Torta de cumpleaños')
    await userEvent.type(label('Energía (kcal)'), '350')
    await userEvent.click(save())

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
    const [input, requestId] = mockedAdd.mock.calls[0]!
    expect(input).toEqual({
      log_date: '2026-10-19',
      meal: 'extra',
      origin: 'manual',
      description: 'Torta de cumpleaños',
      quantity_text: null,
      energy_kcal: 350,
      protein_g: null,
      carbs_g: null,
      sugars_g: null,
      fat_g: null,
      saturated_fat_g: null,
      fiber_g: null,
      sodium_mg: null,
    })
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('acepta la coma decimal y la cantidad descriptiva', async () => {
    renderForm()
    await userEvent.type(label(es.meals.manual.description), 'Guiso')
    await userEvent.type(label(es.meals.manual.quantityText), '1 plato')
    await userEvent.type(label('Energía (kcal)'), '420')
    await userEvent.type(label('Proteínas (g)'), '22,5')
    await userEvent.click(save())
    await waitFor(() => expect(mockedAdd).toHaveBeenCalled())
    expect(mockedAdd.mock.calls[0]![0]).toMatchObject({ quantity_text: '1 plato', protein_g: 22.5 })
  })

  it('todos los campos numéricos tienen etiqueta con su unidad', () => {
    renderForm()
    for (const text of [
      'Energía (kcal)',
      'Proteínas (g)',
      'Carbohidratos (g)',
      'de los cuales azúcares (g)',
      'Grasas totales (g)',
      'de las cuales saturadas (g)',
      'Fibra (g)',
      'Sodio (mg)',
    ]) {
      expect(label(text)).toBeVisible()
    }
  })

  it('FR-006: muestra el error en cada campo y lleva el foco al primero', async () => {
    renderForm()
    await userEvent.type(label('Proteínas (g)'), '-3')
    await userEvent.click(save())
    expect(await screen.findByText(es.meals.manual.errors.descriptionRequired)).toBeVisible()
    expect(screen.getByText(es.meals.manual.errors.energyRequired)).toBeVisible()
    expect(screen.getByText(es.meals.manual.errors.negative)).toBeVisible()
    expect(label(es.meals.manual.description)).toHaveFocus()
    expect(mockedAdd).not.toHaveBeenCalled()
  })

  it('FR-007: avisa si la energía no coincide con los macronutrientes, sin impedir guardar', async () => {
    renderForm()
    await userEvent.type(label(es.meals.manual.description), 'Raro')
    await userEvent.type(label('Energía (kcal)'), '800')
    await userEvent.type(label('Proteínas (g)'), '10')
    await userEvent.type(label('Carbohidratos (g)'), '10')
    await userEvent.type(label('Grasas totales (g)'), '10')
    expect(await screen.findByText(es.foods.form.coherenceNotice(170))).toBeVisible()
    await userEvent.click(save())
    await waitFor(() => expect(mockedAdd).toHaveBeenCalled())
  })

  it('FR-009: el doble clic envía una sola vez', async () => {
    let resolve: (id: string) => void = () => {}
    mockedAdd.mockImplementation(() => new Promise((r) => (resolve = r)))
    const { onAdded } = renderForm({ ...emptyManualForm(), description: 'Pan', energy_kcal: '250' })
    await userEvent.dblClick(save())
    expect(mockedAdd).toHaveBeenCalledTimes(1)
    resolve('entry-1')
    await waitFor(() => expect(onAdded).toHaveBeenCalled())
  })

  it('FR-037: un fallo de red conserva lo escrito y el borrador, y no da por agregado', async () => {
    mockedAdd.mockRejectedValue(new TypeError('Failed to fetch'))
    const { onAdded } = renderForm()
    await userEvent.type(label(es.meals.manual.description), 'Torta')
    await userEvent.type(label('Energía (kcal)'), '350')
    await userEvent.click(save())

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(label(es.meals.manual.description)).toHaveValue('Torta')
    expect(onAdded).not.toHaveBeenCalled()
    expect(localStorage.getItem(draftKey('u1', DRAFT))).toContain('Torta')
  })

  it('un reintento tras un fallo usa el mismo identificador de solicitud', async () => {
    mockedAdd.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('entry-1')
    const { onAdded } = renderForm({ ...emptyManualForm(), description: 'Pan', energy_kcal: '250' })
    await userEvent.click(save())
    await screen.findByRole('alert')
    await userEvent.click(save())
    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(mockedAdd.mock.calls[0]![1]).toBe(mockedAdd.mock.calls[1]![1])
  })

  it('viene precargada cuando se repite un reciente', () => {
    renderForm({
      ...emptyManualForm(),
      description: 'Torta de cumpleaños',
      quantity_text: '1 porción',
      energy_kcal: '380',
    })
    expect(label(es.meals.manual.description)).toHaveValue('Torta de cumpleaños')
    expect(label('Energía (kcal)')).toHaveValue('380')
  })

  it('recupera un borrador y permite descartarlo', async () => {
    localStorage.setItem(
      draftKey('u1', DRAFT),
      JSON.stringify({
        savedAt: Date.now(),
        values: { ...emptyManualForm(), description: 'Borrador', energy_kcal: '99' },
      }),
    )
    renderForm()
    expect(label(es.meals.manual.description)).toHaveValue('Borrador')
    expect(screen.getByText(es.meals.manual.draftRestored)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.meals.manual.draftDiscard }))
    expect(label(es.meals.manual.description)).toHaveValue('')
  })

  it('"Volver a la lista" cancela', async () => {
    const { onCancel } = renderForm()
    await userEvent.click(screen.getByRole('button', { name: es.meals.manual.back }))
    expect(onCancel).toHaveBeenCalled()
  })
})
