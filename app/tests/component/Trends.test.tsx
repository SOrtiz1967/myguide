// Spec 010 (FR-001 a FR-030): la pantalla Tendencias: alimentación, mantenimiento estimado y entrenamiento con sueño.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  fetchNutritionDays,
  fetchSleepBetween,
  fetchTrainingSets,
  fetchWeights,
  fetchWeightUpTo,
} from '../../src/features/trends/api'
import type { DayNutrition } from '../../src/features/trends/nutrition'
import { TrendsPage } from '../../src/features/trends/TrendsPage'

vi.mock('../../src/features/trends/api', () => ({
  fetchNutritionDays: vi.fn(),
  fetchTrainingSets: vi.fn(),
  fetchWeights: vi.fn(),
  fetchWeightUpTo: vi.fn(),
  fetchSleepBetween: vi.fn(),
}))
vi.mock('../../src/features/meals/useToday', () => ({ useToday: () => '2026-11-01' }))
vi.mock('../../src/features/goals/useGoalHistory', () => ({
  useGoalHistory: () => ({
    data: [{ effective_from: '2026-09-01', kcal: 2000, created_at: '2026-09-01T08:00:00Z' }],
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
}))

const mockedNutrition = vi.mocked(fetchNutritionDays)
const mockedTraining = vi.mocked(fetchTrainingSets)
const mockedWeights = vi.mocked(fetchWeights)
const mockedWeightUpTo = vi.mocked(fetchWeightUpTo)
const mockedSleep = vi.mocked(fetchSleepBetween)
const t = es.trends

function day(log_date: string, energy: number, protein: number | null = null): DayNutrition {
  return {
    log_date,
    entries: 1,
    energy_kcal: energy,
    energy_count: 1,
    protein_g: protein,
    protein_count: protein === null ? 0 : 1,
    carbs_g: null,
    carbs_count: 0,
    fat_g: null,
    fat_count: 0,
  }
}

// Hoy es el domingo 2026-11-01: la semana en curso empieza el lunes 2026-10-26.
const DAYS = [day('2026-10-12', 2200), day('2026-10-26', 2000, 100), day('2026-10-27', 1500, 80)]

// La ventana del mantenimiento va del 2026-10-11 al 2026-10-31: 14 días de 2.000 kcal desde el 10-12.
const WINDOW_DAYS = Array.from({ length: 14 }, (_, i) =>
  day(`2026-10-${String(i + 12).padStart(2, '0')}`, 2000),
)
const WINDOW_WEIGHTS = [
  { date: '2026-10-12', value: 80 },
  { date: '2026-10-14', value: 80.4 },
  { date: '2026-10-29', value: 79.6 },
  { date: '2026-10-31', value: 79.2 },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TrendsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedNutrition.mockReset().mockResolvedValue(DAYS)
  mockedWeights.mockReset().mockResolvedValue([])
  mockedWeightUpTo.mockReset().mockResolvedValue({ date: '2026-10-30', value: 75 })
  mockedTraining.mockReset().mockResolvedValue([
    { week_start: '2026-10-19', total_sets: 3, by_muscle: { chest: 3 } },
    { week_start: '2026-10-26', total_sets: 6, by_muscle: { chest: 4, triceps: 4, sin_grupo: 2 } },
  ])
  mockedSleep.mockReset().mockResolvedValue([
    { activity_date: '2026-10-27', value: 420 },
    { activity_date: '2026-10-28', value: 480 },
  ])
})

describe('la pantalla', () => {
  it('tiene las tres secciones y un período con 12 semanas elegido', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: t.nutrition.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t.maintenance.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t.training.title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.periods['12w'] })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('cambiar el período vuelve a pedir los datos con otro rango', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: t.nutrition.title })
    await user.click(screen.getByRole('button', { name: t.periods['1y'] }))
    await waitFor(() => {
      const ranges = mockedNutrition.mock.calls.map((call) => call[0])
      expect(ranges).toContain('2025-11-03')
    })
  })

  it('no usa lenguaje de juicio, de racha, de correlación ni de causa', async () => {
    renderPage()
    await screen.findByText(t.nutrition.protein.title)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(
      /récord|racha|adherencia|déficit|superávit|correlaci|causa|mejor semana|mejoraste|retrocediste/i,
    )
  })
})

describe('alimentación', () => {
  it('muestra el promedio de los días con registro, el objetivo y los días dentro del rango', async () => {
    renderPage()
    const list = await screen.findByRole('list', { name: t.nutrition.listLabel })
    const row = within(list)
      .getByText(/Semana del 26\/10\/2026 al 01\/11\/2026/)
      .closest('li')!
    expect(within(row).getByText(/en curso/)).toBeInTheDocument()
    expect(within(row).getByText('1.750 kcal por día')).toBeInTheDocument()
    expect(within(row).getByText('2 días con registro')).toBeInTheDocument()
    expect(within(row).getByText('Objetivo: 2.000 kcal')).toBeInTheDocument()
    expect(
      within(row).getByText(/1 de 2 días con registro dentro del rango de ±10 % del objetivo/),
    ).toBeInTheDocument()
  })

  it('un nutriente que solo informan algunos días lo dice, y uno que ninguno informa queda sin dato', async () => {
    renderPage()
    const list = await screen.findByRole('list', { name: t.nutrition.listLabel })
    const row = within(list)
      .getByText(/Semana del 26\/10\/2026/)
      .closest('li')!
    expect(within(row).getByText('Proteína: 90 g por día')).toBeInTheDocument()
    expect(within(row).getByText('Carbohidratos: sin dato')).toBeInTheDocument()
  })

  it('una semana sin comidas dice que no hay días con registro, no cero', async () => {
    renderPage()
    const list = await screen.findByRole('list', { name: t.nutrition.listLabel })
    const row = within(list)
      .getByText(/Semana del 02\/11\/2026|Semana del 19\/10\/2026/)
      .closest('li')!
    expect(within(row).getByText(t.noData)).toBeInTheDocument()
    expect(within(row).getByText(t.nutrition.noRecord)).toBeInTheDocument()
  })

  it('la proteína por kilo dice el peso usado y su fecha', async () => {
    renderPage()
    // Promedio de 90 g (2 días con proteína) sobre 75 kg.
    expect(await screen.findByText('1,2 g por kg')).toBeInTheDocument()
    expect(
      screen.getByText(
        /75 kg, tu último peso registrado hasta el final del período \(30\/10\/2026\)/,
      ),
    ).toBeInTheDocument()
  })

  it('sin ningún peso no estima uno y invita a registrarlo', async () => {
    mockedWeightUpTo.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText(new RegExp(t.nutrition.protein.noWeight))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.nutrition.protein.addWeight })).toHaveAttribute(
      'href',
      '/medidas',
    )
  })

  it('sin comidas en el período muestra el estado vacío', async () => {
    mockedNutrition.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(t.nutrition.empty)).toBeInTheDocument()
  })
})

describe('mantenimiento estimado', () => {
  it('con pocos datos no muestra ninguna cifra y dice qué falta', async () => {
    renderPage()
    // La ventana del 10-11 al 10-31 tiene 3 días con calorías de las lecturas simuladas y ningún pesaje.
    expect(await screen.findByText(t.maintenance.missingTitle)).toBeInTheDocument()
    expect(screen.getByText(t.maintenance.progress(3, 0))).toBeInTheDocument()
    expect(screen.getByText(t.maintenance.missingDays(11))).toBeInTheDocument()
    expect(screen.getByText(t.maintenance.missingWeighIns(4))).toBeInTheDocument()
    expect(screen.queryByText(/^Entre /)).not.toBeInTheDocument()
  })

  it('con datos suficientes muestra un rango, la ventana y que es una estimación', async () => {
    mockedNutrition.mockImplementation(async (from) => (from === '2026-10-11' ? WINDOW_DAYS : DAYS))
    mockedWeights.mockResolvedValue(WINDOW_WEIGHTS)
    renderPage()
    expect(await screen.findByText('Entre 2.140 kcal y 2.590 kcal por día')).toBeInTheDocument()
    expect(screen.getByText(t.maintenance.label)).toBeInTheDocument()
    expect(screen.getByText(t.maintenance.window('11/10/2026', '31/10/2026'))).toBeInTheDocument()
    expect(screen.getByText(t.maintenance.basedOn(14, 4))).toBeInTheDocument()
    expect(screen.getByText(t.maintenance.weights('80,2 kg', '79,4 kg'))).toBeInTheDocument()
  })

  it('el método y los sesgos están a la vista y no recomienda cambiar el objetivo', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText(t.maintenance.methodSummary))
    expect(screen.getByText(/7\.700 kcal por kilo/)).toBeInTheDocument()
    for (const bias of t.maintenance.biases) expect(screen.getByText(bias)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.maintenance.goalLink })).toHaveAttribute(
      'href',
      '/objetivo',
    )
    expect(document.body.textContent).not.toMatch(
      /deberías|te conviene|sube tu objetivo|baja tu objetivo/i,
    )
  })
})

describe('entrenamiento y sueño', () => {
  it('elige un grupo y muestra sus series por semana en una tabla equivalente', async () => {
    const user = userEvent.setup()
    renderPage()
    const group = await screen.findByRole('group', { name: t.training.groupLabel })
    await user.click(within(group).getByRole('button', { name: 'Pecho' }))
    await user.click(screen.getByText(t.training.table.summary))
    const table = screen.getByRole('table')
    const current = within(table).getByRole('row', { name: /26\/10\/2026/ })
    expect(within(current).getAllByRole('cell')[0]).toHaveTextContent('4')
    // Sueño de la semana: (420 + 480) / 2 = 450 min = 7 h 30 min, 2 noches con dato.
    expect(within(current).getByText('7 h 30 min')).toBeInTheDocument()
    expect(within(current).getByText('2')).toBeInTheDocument()
  })

  it('«todos los grupos» cuenta cada serie una vez y «sin grupo» es un grupo más', async () => {
    const user = userEvent.setup()
    renderPage()
    const group = await screen.findByRole('group', { name: t.training.groupLabel })
    expect(within(group).getByRole('button', { name: t.training.all })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(group).getByRole('button', { name: t.training.noGroup })).toBeInTheDocument()
    await user.click(screen.getByText(t.training.table.summary))
    const current = within(screen.getByRole('table')).getByRole('row', { name: /26\/10\/2026/ })
    expect(within(current).getAllByRole('cell')[0]).toHaveTextContent('6')
  })

  it('una semana sin sueño dice «sin dato» y no cero horas', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText(t.training.table.summary))
    const previous = within(screen.getByRole('table')).getByRole('row', { name: /19\/10\/2026/ })
    expect(within(previous).getByText(t.noData)).toBeInTheDocument()
  })

  it('el gráfico se recorre con el teclado y lee la semana elegida', async () => {
    const user = userEvent.setup()
    renderPage()
    const chart = await screen.findByRole('group', { name: /Series y sueño por semana/ })
    chart.focus()
    await user.keyboard('{ArrowLeft}')
    const reading = screen.getByRole('status', { name: '' })
    expect(reading).toHaveTextContent(/Semana del 19\/10\/2026 al 25\/10\/2026: 3 series/)
    expect(reading).toHaveTextContent(/Sueño: sin dato/)
  })

  it('no hay coeficientes ni frases que relacionen el sueño con el entrenamiento', async () => {
    renderPage()
    await screen.findByRole('group', { name: /Series y sueño por semana/ })
    expect(screen.getByText(/no calcula ni sugiere ninguna relación/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/r =|coeficiente|duermes (mejor|peor)|rindes/i)
  })

  it('sin sueño muestra el aviso y sigue mostrando las series', async () => {
    mockedSleep.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(new RegExp(t.training.emptySleep))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.training.addSleep })).toHaveAttribute(
      'href',
      '/actividad',
    )
    expect(screen.getByRole('group', { name: /Series y sueño por semana/ })).toBeInTheDocument()
  })

  it('sin series muestra el aviso y sigue mostrando el sueño', async () => {
    mockedTraining.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(t.training.emptyTraining)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Series y sueño por semana/ })).toBeInTheDocument()
  })
})

describe('errores', () => {
  it('si una sección falla muestra el error y las demás siguen', async () => {
    mockedTraining.mockRejectedValue(new Error('boom'))
    renderPage()
    expect((await screen.findAllByText(t.loadError)).length).toBeGreaterThan(0)
    expect(await screen.findByText(t.nutrition.protein.title)).toBeInTheDocument()
  })
})
