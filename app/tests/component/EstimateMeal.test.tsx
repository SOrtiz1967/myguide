// Spec 009 (FR-001 a FR-007, FR-012, FR-018): describir una comida con IA, revisarla y confirmarla.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  confirmEstimate,
  EstimateError,
  estimateMeal,
  type EstimatedItem,
} from '../../src/features/meals/ai/api'
import { EstimateFlow } from '../../src/features/meals/ai/EstimateFlow'
import { addEntry } from '../../src/features/meals/api'
import { ManualEntryForm } from '../../src/features/meals/ManualEntryForm'

vi.mock('../../src/features/meals/ai/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/meals/ai/api')>()),
  estimateMeal: vi.fn(),
  confirmEstimate: vi.fn(),
}))
vi.mock('../../src/features/meals/api', () => ({ addEntry: vi.fn() }))

const mockedEstimate = vi.mocked(estimateMeal)
const mockedConfirm = vi.mocked(confirmEstimate)
const mockedAdd = vi.mocked(addEntry)
const ai = es.meals.ai

const ITEMS: EstimatedItem[] = [
  {
    name: 'Milanesa al horno',
    quantity_text: '2 unidades',
    energy_kcal: 520,
    protein_g: 44,
    carbs_g: 30,
    fat_g: 24,
  },
  {
    name: 'Puré',
    quantity_text: null,
    energy_kcal: 180,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
  },
  {
    name: 'Manzana',
    quantity_text: '1 unidad',
    energy_kcal: 95,
    protein_g: 0.5,
    carbs_g: 25,
    fat_g: 0.3,
  },
]

function renderFlow() {
  const onAdded = vi.fn()
  const onManual = vi.fn()
  const onCancel = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <EstimateFlow
        userId="u1"
        date="2026-11-01"
        meal="lunch"
        onCancel={onCancel}
        onManual={onManual}
        onAdded={onAdded}
      />
    </QueryClientProvider>,
  )
  return { onAdded, onManual, onCancel }
}

const textbox = () => screen.getByLabelText(ai.textLabel)
const estimateButton = () => screen.getByRole('button', { name: ai.estimate })

async function estimateText(text = '2 milanesas al horno con puré y una manzana') {
  await userEvent.type(textbox(), text)
  await userEvent.click(estimateButton())
}

beforeEach(() => {
  mockedEstimate.mockReset().mockResolvedValue(ITEMS)
  mockedConfirm.mockReset().mockResolvedValue(['e1', 'e2', 'e3'])
  mockedAdd.mockReset().mockResolvedValue('entry-1')
})

describe('Describir con IA: escribir y estimar', () => {
  it('FR-001: manda el texto recortado con un identificador de solicitud y muestra la propuesta', async () => {
    renderFlow()
    await userEvent.type(textbox(), '  2 milanesas con puré  ')
    await userEvent.click(estimateButton())

    expect(await screen.findByRole('heading', { name: ai.review.title })).toBeInTheDocument()
    expect(mockedEstimate).toHaveBeenCalledTimes(1)
    const [text, requestId] = mockedEstimate.mock.calls[0]!
    expect(text).toBe('2 milanesas con puré')
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(screen.getAllByText(ai.review.status)).toHaveLength(3)
    expect(screen.getByText(ai.review.total('795'))).toBeInTheDocument()
  })

  it('FR-001: un texto vacío o de más de 500 caracteres se avisa antes de consultar', async () => {
    renderFlow()
    await userEvent.click(estimateButton())
    expect(screen.getByRole('alert')).toHaveTextContent(ai.errors.textRequired)

    await userEvent.type(textbox(), 'a')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.clear(textbox())
    // Pegar un texto largo en un solo gesto.
    await userEvent.click(textbox())
    await userEvent.paste('a'.repeat(501))
    await userEvent.click(estimateButton())
    expect(screen.getByRole('alert')).toHaveTextContent(ai.errors.textTooLong(500))
    expect(mockedEstimate).not.toHaveBeenCalled()
  })

  it('SC-003: un doble toque en «Estimar» hace una sola consulta', async () => {
    mockedEstimate.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(ITEMS), 30)),
    )
    renderFlow()
    await userEvent.type(textbox(), 'una manzana')
    await userEvent.dblClick(estimateButton())
    await screen.findByRole('heading', { name: ai.review.title })
    expect(mockedEstimate).toHaveBeenCalledTimes(1)
  })

  it('mientras calcula anuncia la espera y permite cancelarla sin perder el texto', async () => {
    mockedEstimate.mockImplementation(() => new Promise(() => {}))
    renderFlow()
    await userEvent.type(textbox(), 'una manzana')
    await userEvent.click(estimateButton())
    expect(screen.getByRole('status')).toHaveTextContent(ai.estimating)

    await userEvent.click(screen.getByRole('button', { name: ai.cancelWait }))
    expect(screen.queryByText(ai.estimating)).not.toBeInTheDocument()
    expect(textbox()).toHaveValue('una manzana')
    expect(estimateButton()).toBeEnabled()
  })

  it('una respuesta tardía de una espera cancelada se ignora', async () => {
    let resolve!: (items: EstimatedItem[]) => void
    mockedEstimate.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderFlow()
    await userEvent.type(textbox(), 'una manzana')
    await userEvent.click(estimateButton())
    await userEvent.click(screen.getByRole('button', { name: ai.cancelWait }))
    resolve(ITEMS)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('heading', { name: ai.review.title })).not.toBeInTheDocument()
  })

  it('FR-012: cada fallo muestra su mensaje, conserva el texto y deja el camino manual', async () => {
    const { onManual } = renderFlow()
    for (const code of [
      'ai_unavailable',
      'ai_timeout',
      'daily_limit',
      'quota_exhausted',
      'no_items',
    ]) {
      mockedEstimate.mockRejectedValueOnce(new EstimateError(code))
    }
    await userEvent.type(textbox(), 'una manzana')
    for (const code of [
      'ai_unavailable',
      'ai_timeout',
      'daily_limit',
      'quota_exhausted',
      'no_items',
    ] as const) {
      await userEvent.click(estimateButton())
      expect(await screen.findByRole('alert')).toHaveTextContent(ai.errors[code])
      expect(textbox()).toHaveValue('una manzana')
    }
    await userEvent.click(screen.getByRole('button', { name: ai.writeByHand }))
    expect(onManual).toHaveBeenCalledTimes(1)
  })

  it('un fallo de red se explica como falta de conexión', async () => {
    mockedEstimate.mockRejectedValue(new EstimateError('offline'))
    renderFlow()
    await estimateText('una manzana')
    expect(await screen.findByRole('alert')).toHaveTextContent(ai.errors.offline)
  })

  it('reintentar con el mismo texto reutiliza el identificador; otro texto, uno nuevo', async () => {
    mockedEstimate.mockRejectedValueOnce(new EstimateError('ai_timeout'))
    renderFlow()
    await userEvent.type(textbox(), 'una manzana')
    await userEvent.click(estimateButton())
    await screen.findByRole('alert')
    await userEvent.click(estimateButton())
    await screen.findByRole('heading', { name: ai.review.title })
    expect(mockedEstimate.mock.calls[1]![1]).toBe(mockedEstimate.mock.calls[0]![1])

    await userEvent.click(screen.getByRole('button', { name: ai.review.back }))
    await userEvent.type(textbox(), ' y un café')
    await userEvent.click(estimateButton())
    await waitFor(() => expect(mockedEstimate).toHaveBeenCalledTimes(3))
    expect(mockedEstimate.mock.calls[2]![1]).not.toBe(mockedEstimate.mock.calls[0]![1])
  })
})

describe('Describir con IA: revisar y confirmar', () => {
  it('FR-003: antes de confirmar no se guarda nada', async () => {
    const { onAdded } = renderFlow()
    await estimateText()
    await screen.findByRole('heading', { name: ai.review.title })
    expect(mockedConfirm).not.toHaveBeenCalled()
    expect(mockedAdd).not.toHaveBeenCalled()
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('FR-004/FR-005: corregir, quitar y agregar; al confirmar se guardan todos juntos', async () => {
    const { onAdded } = renderFlow()
    await estimateText()
    await screen.findByRole('heading', { name: ai.review.title })

    const first = screen.getByRole('group', { name: ai.review.itemTitle(1) })
    const energy = within(first).getByLabelText('Energía (kcal)')
    await userEvent.clear(energy)
    await userEvent.type(energy, '480,5')

    await userEvent.click(screen.getByRole('button', { name: ai.review.remove('Puré') }))
    expect(screen.queryByDisplayValue('Puré')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: ai.review.addItem }))
    const added = screen.getByRole('group', { name: ai.review.itemTitle(3) })
    await userEvent.type(
      within(added).getByLabelText(es.meals.manual.description),
      'Agua saborizada',
    )
    await userEvent.type(within(added).getByLabelText('Energía (kcal)'), '20')
    expect(screen.getByText(ai.review.total('596'))).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: ai.review.confirm }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))

    expect(mockedConfirm).toHaveBeenCalledTimes(1)
    const [input, requestId] = mockedConfirm.mock.calls[0]!
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(input).toMatchObject({ log_date: '2026-11-01', meal: 'lunch' })
    expect(input.items.map((entry) => [entry.description, entry.energy_kcal])).toEqual([
      ['Milanesa al horno', 480.5],
      ['Manzana', 95],
      ['Agua saborizada', 20],
    ])
    expect(input.items[0]).toMatchObject({
      quantity_text: '2 unidades',
      protein_g: 44,
      sugars_g: null,
    })
  })

  it('FR-004: un ítem inválido no guarda y marca qué falta', async () => {
    renderFlow()
    await estimateText()
    await screen.findByRole('heading', { name: ai.review.title })
    const first = screen.getByRole('group', { name: ai.review.itemTitle(1) })
    await userEvent.clear(within(first).getByLabelText('Energía (kcal)'))
    await userEvent.click(screen.getByRole('button', { name: ai.review.confirm }))

    expect(await screen.findByText(ai.review.invalidItems)).toBeInTheDocument()
    expect(within(first).getByText(es.meals.manual.errors.energyRequired)).toBeInTheDocument()
    expect(mockedConfirm).not.toHaveBeenCalled()
  })

  it('sin ítems no se puede confirmar', async () => {
    renderFlow()
    await estimateText()
    await screen.findByRole('heading', { name: ai.review.title })
    for (const name of ['Milanesa al horno', 'Puré', 'Manzana']) {
      await userEvent.click(screen.getByRole('button', { name: ai.review.remove(name) }))
    }
    expect(screen.getByText(ai.review.removed)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: ai.review.confirm }))
    expect(mockedConfirm).not.toHaveBeenCalled()
  })

  it('SC-003: un doble toque en «Confirmar» guarda una sola vez', async () => {
    mockedConfirm.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(['e1']), 30)),
    )
    const { onAdded } = renderFlow()
    await estimateText()
    await screen.findByRole('heading', { name: ai.review.title })
    await userEvent.dblClick(screen.getByRole('button', { name: ai.review.confirm }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
    expect(mockedConfirm).toHaveBeenCalledTimes(1)
  })

  it('si falla el guardado conserva lo editado y reintenta con el mismo identificador', async () => {
    mockedConfirm.mockRejectedValueOnce(new Error('boom'))
    const { onAdded } = renderFlow()
    await estimateText()
    await screen.findByRole('heading', { name: ai.review.title })
    const first = screen.getByRole('group', { name: ai.review.itemTitle(1) })
    const energy = within(first).getByLabelText('Energía (kcal)')
    await userEvent.clear(energy)
    await userEvent.type(energy, '400')

    await userEvent.click(screen.getByRole('button', { name: ai.review.confirm }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onAdded).not.toHaveBeenCalled()
    expect(within(first).getByLabelText('Energía (kcal)')).toHaveValue('400')

    await userEvent.click(screen.getByRole('button', { name: ai.review.confirm }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
    expect(mockedConfirm.mock.calls[1]![1]).toBe(mockedConfirm.mock.calls[0]![1])
  })

  it('FR-017: la propuesta recuerda que son aproximaciones y no juzga', async () => {
    renderFlow()
    await estimateText()
    await screen.findByRole('heading', { name: ai.review.title })
    expect(screen.getByText(ai.review.note)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\b(bueno|malo|demasiad[oa]s? calor|compensa)/i)
  })

  it('«Volver al texto» vuelve a escribir sin guardar', async () => {
    renderFlow()
    await estimateText('una manzana')
    await screen.findByRole('heading', { name: ai.review.title })
    await userEvent.click(screen.getByRole('button', { name: ai.review.back }))
    expect(textbox()).toHaveValue('una manzana')
    expect(mockedConfirm).not.toHaveBeenCalled()
  })
})

describe('Calcular con IA en la carga a mano', () => {
  function renderManual() {
    const onAdded = vi.fn()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ManualEntryForm
          userId="u1"
          date="2026-11-01"
          meal="lunch"
          draftId="meal-manual-ai-test"
          onAdded={onAdded}
          allowAi
        />
      </QueryClientProvider>,
    )
    return { onAdded }
  }
  const calculate = () => screen.getByRole('button', { name: ai.manual.calculate })
  const field = (text: string) => screen.getByLabelText(text, { exact: false })

  beforeEach(() => {
    window.localStorage.clear()
    mockedEstimate.mockResolvedValue([
      {
        name: 'Tarta de verdura',
        quantity_text: '1 porción',
        energy_kcal: 310,
        protein_g: 12,
        carbs_g: 28,
        fat_g: 16,
      },
    ])
  })

  it('sin nombre avisa y no consulta', async () => {
    renderManual()
    await userEvent.click(calculate())
    expect(await screen.findByRole('alert')).toHaveTextContent(ai.manual.needName)
    expect(mockedEstimate).not.toHaveBeenCalled()
  })

  it('completa energía y macros como estimación y se guarda como estimado', async () => {
    const { onAdded } = renderManual()
    await userEvent.type(field(es.meals.manual.description), 'Tarta de verdura casera')
    await userEvent.type(field(es.meals.manual.quantityText), '1 porción')
    await userEvent.click(calculate())

    await waitFor(() => expect(field('Energía (kcal)')).toHaveValue('310'))
    expect(mockedEstimate.mock.calls[0]![0]).toBe('Tarta de verdura casera, 1 porción')
    expect(field('Proteínas (g)')).toHaveValue('12')
    expect(screen.getByText(ai.manual.status)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: es.meals.manual.save }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
    expect(mockedAdd).not.toHaveBeenCalled()
    const [input] = mockedConfirm.mock.calls[0]!
    expect(input).toMatchObject({ log_date: '2026-11-01', meal: 'lunch' })
    expect(input.items[0]).toMatchObject({
      description: 'Tarta de verdura casera',
      energy_kcal: 310,
    })
  })

  it('FR-006: con valores ya escritos pregunta antes de reemplazarlos', async () => {
    renderManual()
    await userEvent.type(field(es.meals.manual.description), 'Tarta')
    await userEvent.type(field('Energía (kcal)'), '999')
    await userEvent.click(calculate())

    const group = await screen.findByRole('group', { name: ai.manual.replaceTitle })
    expect(field('Energía (kcal)')).toHaveValue('999')
    await userEvent.click(within(group).getByRole('button', { name: ai.manual.keep }))
    expect(field('Energía (kcal)')).toHaveValue('999')
    expect(screen.queryByText(ai.manual.status)).not.toBeInTheDocument()

    await userEvent.click(calculate())
    await userEvent.click(await screen.findByRole('button', { name: ai.manual.replace }))
    await waitFor(() => expect(field('Energía (kcal)')).toHaveValue('310'))
  })

  it('si la IA falla, muestra el motivo y el formulario manual sigue igual', async () => {
    mockedEstimate.mockRejectedValue(new EstimateError('ai_unavailable'))
    const { onAdded } = renderManual()
    await userEvent.type(field(es.meals.manual.description), 'Tarta')
    await userEvent.click(calculate())
    expect(await screen.findByRole('alert')).toHaveTextContent(ai.errors.ai_unavailable)

    await userEvent.type(field('Energía (kcal)'), '300')
    await userEvent.click(screen.getByRole('button', { name: es.meals.manual.save }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
    expect(mockedAdd.mock.calls[0]![0]).toMatchObject({ origin: 'manual', energy_kcal: 300 })
  })
})
