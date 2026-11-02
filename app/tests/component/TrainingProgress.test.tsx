// Spec 012 (FR-001 a FR-016, FR-022): la evolución de un ejercicio, la comparación y el resumen de actividad.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  fetchCompletedDates,
  fetchExerciseProgress,
} from '../../src/features/training/progress/api'
import { ActivitySummaryPage } from '../../src/features/training/progress/ActivitySummaryPage'
import { ExerciseProgressPage } from '../../src/features/training/progress/ExerciseProgressPage'
import type { ProgressRow } from '../../src/features/training/progress/series'

vi.mock('../../src/features/training/progress/api', () => ({
  fetchExerciseProgress: vi.fn(),
  fetchCompletedDates: vi.fn(),
}))
vi.mock('../../src/features/meals/useToday', () => ({ useToday: () => '2026-11-01' }))
vi.mock('../../src/features/exercises/useExercise', () => ({
  useExercise: () => ({ data: { name: 'Press de banca' } }),
}))

const mockedProgress = vi.mocked(fetchExerciseProgress)
const mockedDates = vi.mocked(fetchCompletedDates)
const p = es.trainingProgress
const a = es.trainingActivity

const row = (
  id: string,
  date: string,
  sets: ProgressRow['sets'],
  effort: number | null = null,
  type = 'reps_weight',
): ProgressRow => ({
  session_id: id,
  session_date: date,
  exercise_name: 'Press de banca',
  measurement_type: type,
  effort,
  sets,
})

// Octubre: 62,5 / 65 / 70 kg. Septiembre (período anterior de 4 semanas): 55 y 60 kg.
const ROWS: ProgressRow[] = [
  row('s1', '2026-09-10', [{ reps: 8, weight_kg: 55 }]),
  row('s2', '2026-09-24', [{ reps: 8, weight_kg: 60 }]),
  row(
    's3',
    '2026-10-08',
    [
      { reps: 8, weight_kg: 60 },
      { reps: 6, weight_kg: 62.5 },
    ],
    7,
  ),
  row('s4', '2026-10-15', [{ reps: 8, weight_kg: 65 }, { reps: 12 }]),
  row('s5', '2026-10-29', [{ reps: 5, weight_kg: 70 }]),
]

function renderProgress() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/ejercicios/e1/evolucion']}>
        <Routes>
          <Route path="/ejercicios/:id/evolucion" element={<ExerciseProgressPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderActivity() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ActivitySummaryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const chip = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  mockedProgress.mockReset().mockResolvedValue(ROWS)
  mockedDates.mockReset().mockResolvedValue([])
})

describe('Evolución de un ejercicio', () => {
  it('FR-001/FR-002: un punto por sesión del período, con fecha, valor y unidad en la tabla', async () => {
    renderProgress()
    expect(await screen.findByRole('group', { name: p.measureLabel })).toBeInTheDocument()
    expect(screen.getByText('Press de banca')).toBeInTheDocument()
    // 12 semanas hasta el 1/11 incluye desde el 10/8: las 5 sesiones.
    expect(screen.getByText(p.summary(5, '10/08/2026', '01/11/2026'))).toBeInTheDocument()
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    expect(within(rows[0]!).getByText('70 kg')).toBeInTheDocument()
    expect(within(rows[4]!).getByText('55 kg')).toBeInTheDocument()
  })

  it('FR-003: ofrece las medidas del tipo del ejercicio y explica cómo se calcula', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    for (const key of ['max_weight', 'volume', 'total_reps'] as const) {
      expect(chip(p.measures[key])).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: p.measures.total_time })).not.toBeInTheDocument()
    expect(screen.getByText(p.howCalculated.max_weight)).toBeInTheDocument()

    await userEvent.click(chip(p.measures.volume))
    expect(screen.getByText(p.howCalculated.volume)).toBeInTheDocument()
    const table = screen.getByRole('table')
    // 8·60 + 6·62,5 = 855
    expect(within(table).getByText('855 kg')).toBeInTheDocument()
  })

  it('un ejercicio de tiempo ofrece tiempo total y serie más larga', async () => {
    mockedProgress.mockResolvedValue([
      row('t1', '2026-10-20', [{ duration_s: 60 }, { duration_s: 90 }], null, 'duration'),
    ])
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    expect(chip(p.measures.total_time)).toBeInTheDocument()
    expect(chip(p.measures.longest_set)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: p.measures.volume })).not.toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('2 min 30 s')).toBeInTheDocument()
  })

  it('FR-006: cambiar el período recorta las sesiones', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    await userEvent.click(chip(p.periods['4w']))
    // 4 semanas hasta el 1/11: desde el 5/10 → s3, s4, s5.
    expect(screen.getByText(p.summary(3, '05/10/2026', '01/11/2026'))).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4)
  })

  it('FR-007: con 3 sesiones con dato une los puntos; con menos, no hay línea y se avisa', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    expect(screen.getByText(p.legendLine)).toBeInTheDocument()
    expect(screen.queryByText(p.notEnough)).not.toBeInTheDocument()

    mockedProgress.mockResolvedValue(ROWS.slice(0, 2))
    renderProgress()
    expect(await screen.findAllByText(p.notEnough)).toHaveLength(1)
  })

  it('FR-005: informa las series excluidas y lista las sesiones sin dato', async () => {
    mockedProgress.mockResolvedValue([
      ...ROWS,
      row('s6', '2026-10-30', [{ reps: 12 }, { reps: 10 }]),
    ])
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    expect(screen.getByText(p.excluded(3))).toBeInTheDocument()
    expect(screen.getByText(p.noDataTitle)).toBeInTheDocument()
    expect(screen.getByText(/30\/10\/2026: sin dato/)).toBeInTheDocument()
    // La sesión sin dato no es un punto ni un cero.
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(6)
    expect(within(screen.getByRole('table')).queryByText('0 kg')).not.toBeInTheDocument()
  })

  it('FR-015: el esfuerzo percibido se ve junto al punto y dice «sin dato» cuando falta', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    const table = screen.getByRole('table')
    expect(within(table).getByText(p.effort(7))).toBeInTheDocument()
    expect(within(table).getAllByText(p.effortNone).length).toBeGreaterThan(0)
  })

  it('FR-022: el gráfico se recorre con el teclado y lee cada sesión', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    const chart = screen.getByRole('group', { name: /Gráfico de 5 sesiones/ })
    chart.focus()
    expect(await screen.findByText(/29\/10\/2026: 70 kg/)).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByText(/15\/10\/2026: 65 kg/)).toBeInTheDocument()
    await userEvent.keyboard('{Home}')
    expect(screen.getByText(/10\/09\/2026: 55 kg/)).toBeInTheDocument()
  })

  it('FR-008: sin sesiones muestra el estado vacío', async () => {
    mockedProgress.mockResolvedValue([])
    renderProgress()
    expect(await screen.findByText(p.empty)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('sin sesiones en el período lo dice y no dibuja ejes', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    mockedProgress.mockResolvedValue([row('old', '2025-01-01', [{ reps: 5, weight_kg: 40 }])])
    renderProgress()
    expect((await screen.findAllByText(p.emptyPeriod)).length).toBeGreaterThan(0)
  })

  it('un error de carga permite reintentar', async () => {
    mockedProgress.mockRejectedValueOnce(new Error('boom'))
    renderProgress()
    expect(await screen.findByText(p.loadError)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('FR-020: los textos no hablan de récords, rachas, metas ni valoraciones', () => {
    const all = JSON.stringify({ p, a })
    expect(all).not.toMatch(
      /\b(récord|record|racha|meta|mejora|mejoraste|retroceso|retrocediste|bueno|malo)\b/i,
    )
  })
})

describe('Comparar con el período anterior', () => {
  it('FR-010/FR-011: promedio y sesiones de cada período y la diferencia con su unidad', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    await userEvent.click(chip(p.periods['4w']))
    await userEvent.click(chip(p.compare.title))

    const panel = screen.getByRole('region', { name: p.compare.title })
    // Actual (5/10 a 1/11): s3 62,5 · s4 65 · s5 70 → 65,83; anterior (7/9 a 4/10): s1 55 · s2 60 → 57,5
    expect(within(panel).getByText(p.compare.sessions(3))).toBeInTheDocument()
    expect(within(panel).getByText(p.compare.sessions(2))).toBeInTheDocument()
    expect(within(panel).getByText('65,8 kg')).toBeInTheDocument()
    expect(within(panel).getByText('57,5 kg')).toBeInTheDocument()
    expect(within(panel).getByText(`${p.compare.difference}: +8,3 kg`)).toBeInTheDocument()
  })

  it('FR-012: con menos de 2 sesiones con dato en un período no hay diferencia', async () => {
    mockedProgress.mockResolvedValue(ROWS.slice(1))
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    await userEvent.click(chip(p.periods['4w']))
    await userEvent.click(chip(p.compare.title))
    const panel = screen.getByRole('region', { name: p.compare.title })
    expect(within(panel).getByText(p.compare.notEnough)).toBeInTheDocument()
    expect(within(panel).queryByText(new RegExp(p.compare.difference))).not.toBeInTheDocument()
  })

  it('«Todo el historial» no se compara', async () => {
    renderProgress()
    await screen.findByRole('group', { name: p.measureLabel })
    await userEvent.click(chip(p.periods.all))
    expect(screen.getByText(p.compare.unavailable)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: p.compare.title })).not.toBeInTheDocument()
  })
})

describe('Resumen de actividad', () => {
  it('FR-013: cuenta las sesiones de cada semana y deja en cero las vacías', async () => {
    mockedDates.mockResolvedValue(['2026-10-05', '2026-10-06', '2026-10-19', '2026-10-26'])
    renderActivity()
    expect(await screen.findByText(a.total(4))).toBeInTheDocument()
    const list = screen.getByRole('list', { name: a.chartLabel })
    const items = within(list).getAllByRole('listitem')
    // De la semana más reciente a la más antigua.
    expect(within(items[0]!).getByText(a.sessions(1))).toBeInTheDocument()
    expect(within(items[0]!).getByText(a.weekLabel('26/10/2026', '01/11/2026'))).toBeInTheDocument()
    expect(within(list).getAllByText(a.none).length).toBeGreaterThan(0)
    expect(within(list).getByText(a.sessions(2))).toBeInTheDocument()
  })

  it('agrupa por mes', async () => {
    mockedDates.mockResolvedValue(['2026-09-30', '2026-10-05', '2026-10-06'])
    renderActivity()
    await screen.findByText(a.total(3))
    await userEvent.click(screen.getByRole('button', { name: a.groupings.month }))
    const list = screen.getByRole('list', { name: a.chartLabel })
    expect(within(list).getByText('octubre de 2026')).toBeInTheDocument()
    expect(within(list).getByText(a.sessions(2))).toBeInTheDocument()
  })

  it('FR-014: sin objetivos, rachas ni mensajes sobre la constancia', async () => {
    mockedDates.mockResolvedValue(['2026-10-05'])
    renderActivity()
    await screen.findByText(a.total(1))
    expect(document.body.textContent).not.toMatch(
      /racha|objetivo|mejor semana|constancia|no entrenaste/i,
    )
  })

  it('sin sesiones realizadas muestra un estado vacío', async () => {
    renderActivity()
    await waitFor(() => expect(screen.getByText(a.emptyPeriod)).toBeInTheDocument())
    await userEvent.click(chip(p.periods.all))
    expect(await screen.findByText(a.empty)).toBeInTheDocument()
  })

  it('un error de carga permite reintentar', async () => {
    mockedDates.mockRejectedValueOnce(new Error('boom'))
    renderActivity()
    expect(await screen.findByText(a.loadError)).toBeInTheDocument()
    mockedDates.mockResolvedValue(['2026-10-05'])
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByText(a.total(1))).toBeInTheDocument()
  })
})
