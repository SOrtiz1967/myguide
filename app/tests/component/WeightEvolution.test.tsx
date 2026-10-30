// Spec 020: evolución del peso — gráfico, períodos, pocos datos, ayunas y cifras (FR-001 a FR-015).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchWeightsBetween, type Measurement } from '../../src/features/measures/api'
import { WeightEvolution } from '../../src/features/measures/WeightEvolution'

vi.mock('../../src/features/measures/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/measures/api')>()),
  fetchWeightsBetween: vi.fn(),
}))
vi.mock('../../src/features/meals/useToday', () => ({ useToday: () => '2026-10-30' }))

const c = es.measures.evolution

const weight = (date: string, value: number, fasting = false): Measurement => ({
  id: date,
  kind: 'weight',
  value,
  measured_on: date,
  note: null,
  fasting,
})

// Doce pesos en cuatro semanas, con tres seguidos para tener promedio.
const TWELVE = [
  weight('2026-10-02', 73.0, true),
  weight('2026-10-04', 72.8),
  weight('2026-10-06', 73.2, true),
  weight('2026-10-09', 72.6),
  weight('2026-10-12', 72.4, true),
  weight('2026-10-14', 72.9),
  weight('2026-10-16', 72.2),
  weight('2026-10-19', 72.5, true),
  weight('2026-10-21', 72.1),
  weight('2026-10-24', 71.9, true),
  weight('2026-10-27', 72.3),
  weight('2026-10-29', 71.8),
]

function renderBlock() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <WeightEvolution />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(fetchWeightsBetween).mockReset().mockResolvedValue(TWELVE)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('gráfico y cifras', () => {
  it('muestra un registro por peso, la leyenda y la cantidad', async () => {
    renderBlock()
    const chart = await screen.findByRole('group', {
      name: /Gráfico del peso en kilogramos, 12 registros/,
    })
    expect(chart).toBeInTheDocument()
    const legend = screen.getByRole('list', { name: c.legend })
    expect(within(legend).getByText(c.legendWeight)).toBeVisible()
    expect(within(legend).getByText(c.legendAverage)).toBeVisible()
    const figures = screen.getByRole('region', { name: c.stats.title })
    expect(within(figures).getByText(c.stats.count).nextSibling).toHaveTextContent('12')
  })

  it('pide los pesos de los últimos 90 días más 6 días de ventana previa', async () => {
    renderBlock()
    await screen.findByRole('group', { name: /Gráfico del peso/ })
    // 90 días terminando hoy empiezan el 2026-08-02; con la ventana previa, el 2026-07-27.
    expect(fetchWeightsBetween).toHaveBeenCalledWith('2026-07-27', '2026-10-30')
  })

  it('cambiar de período vuelve a pedir los datos del nuevo período', async () => {
    renderBlock()
    await screen.findByRole('group', { name: /Gráfico del peso/ })
    await userEvent.click(screen.getByRole('button', { name: c.periods['30d'] }))
    await waitFor(() =>
      expect(fetchWeightsBetween).toHaveBeenCalledWith('2026-09-25', '2026-10-30'),
    )
    await userEvent.click(screen.getByRole('button', { name: c.periods.all }))
    await waitFor(() =>
      expect(fetchWeightsBetween).toHaveBeenCalledWith('2000-01-01', '2026-10-30'),
    )
    expect(screen.getByRole('button', { name: c.periods.all })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('las cifras son descriptivas: último, mínimo y máximo con sus fechas', async () => {
    renderBlock()
    const figures = await screen.findByRole('region', { name: c.stats.title })
    const valueOf = (label: string) => within(figures).getByText(label).nextSibling
    expect(valueOf(c.stats.last)).toHaveTextContent('71,8 kg (29/10/2026)')
    expect(valueOf(c.stats.min)).toHaveTextContent('71,8 kg (29/10/2026)')
    expect(valueOf(c.stats.max)).toHaveTextContent('73,2 kg (06/10/2026)')
  })

  it('la tabla alternativa tiene todos los registros', async () => {
    renderBlock()
    await screen.findByRole('group', { name: /Gráfico del peso/ })
    const table = screen.getByRole('table')
    // Encabezado + 12 filas.
    expect(within(table).getAllByRole('row')).toHaveLength(13)
    expect(within(table).getAllByText(c.table.none).length).toBeGreaterThan(0)
  })

  it('con las flechas se recorre cada registro y se lee su valor y promedio', async () => {
    renderBlock()
    const chart = await screen.findByRole('group', { name: /Gráfico del peso/ })
    chart.focus()
    expect(await screen.findByText(/29.*71,8 kg/)).toBeVisible()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByText(/27.*72,3 kg/)).toBeVisible()
    await userEvent.keyboard('{Home}')
    expect(screen.getByText(/2.*73,0 kg\. Sin promedio de 7 días/)).toBeVisible()
    await userEvent.keyboard('{End}')
    expect(screen.getByText(/29.*71,8 kg/)).toBeVisible()
  })

  it('no usa frases de cambio, tendencia, meta ni juicio', async () => {
    renderBlock()
    await screen.findByRole('group', { name: /Gráfico del peso/ })
    expect(JSON.stringify(es.measures.evolution)).not.toMatch(
      /bajaste|subiste|perdiste|ganaste|tendencia|meta|objetivo|mejor|peor|logro|excelente/i,
    )
    expect(document.body.textContent).not.toMatch(/bajaste|subiste|perdiste|ganaste/i)
  })
})

describe('pocos datos (Principio V)', () => {
  it('sin pesos muestra un estado vacío que invita a registrar', async () => {
    vi.mocked(fetchWeightsBetween).mockResolvedValue([])
    renderBlock()
    expect(await screen.findByText(c.emptyTitle)).toBeVisible()
    expect(screen.getByText(c.emptyBody)).toBeVisible()
    expect(screen.queryByRole('group', { name: /Gráfico del peso/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: c.stats.title })).not.toBeInTheDocument()
  })

  it('con pesos solo anteriores al período sugiere ampliarlo', async () => {
    vi.mocked(fetchWeightsBetween).mockResolvedValue([weight('2026-01-10', 74)])
    renderBlock()
    expect(await screen.findByText(c.emptyTitle)).toBeVisible()
    expect(screen.getByText(c.emptyOlder)).toBeVisible()
  })

  it('con un solo registro dice que no alcanza para ver una evolución y no muestra promedio', async () => {
    vi.mocked(fetchWeightsBetween).mockResolvedValue([weight('2026-10-28', 72.4)])
    renderBlock()
    expect(await screen.findByText(c.oneRecord)).toBeVisible()
    const figures = screen.getByRole('region', { name: c.stats.title })
    expect(within(figures).getByText(c.stats.noAverage)).toBeVisible()
  })

  it('con dos registros no hay promedio y el gráfico lo aclara una vez', async () => {
    vi.mocked(fetchWeightsBetween).mockResolvedValue([
      weight('2026-10-27', 72.4),
      weight('2026-10-28', 72.1),
    ])
    renderBlock()
    expect(await screen.findByText(c.fewRecords)).toBeVisible()
    const figures = screen.getByRole('region', { name: c.stats.title })
    expect(within(figures).getByText(c.stats.noAverage)).toBeVisible()
  })

  it('si falla la carga muestra un error con reintento', async () => {
    vi.mocked(fetchWeightsBetween).mockRejectedValueOnce(new Error('x'))
    renderBlock()
    expect(await screen.findByText(c.loadError)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('group', { name: /Gráfico del peso/ })).toBeInTheDocument()
  })
})

describe('peso en ayunas', () => {
  it('«Solo en ayunas» usa únicamente los marcados y dice cuántos quedaron fuera', async () => {
    renderBlock()
    await screen.findByRole('group', { name: /12 registros/ })
    await userEvent.click(screen.getByRole('button', { name: c.filter.fasting }))
    expect(
      await screen.findByRole('group', { name: /Gráfico del peso en kilogramos, 5 registros/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(c.excluded(7))).toBeVisible()
  })

  it('la elección se recuerda al volver a abrir', async () => {
    const first = renderBlock()
    await screen.findByRole('group', { name: /12 registros/ })
    await userEvent.click(screen.getByRole('button', { name: c.filter.fasting }))
    first.unmount()
    renderBlock()
    expect(await screen.findByRole('button', { name: c.filter.fasting })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('si el almacenamiento falla usa «Todos los pesos» sin errores', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    renderBlock()
    expect(await screen.findByRole('button', { name: c.filter.all })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: c.filter.fasting }))
    expect(screen.getByRole('button', { name: c.filter.fasting })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('sin ningún peso marcado explica por qué no hay nada que mostrar', async () => {
    vi.mocked(fetchWeightsBetween).mockResolvedValue([
      weight('2026-10-27', 72.4),
      weight('2026-10-28', 72.1),
    ])
    localStorage.setItem('myguide:weight-fasting-only', '1')
    renderBlock()
    expect(await screen.findByText(c.emptyFasting)).toBeVisible()
  })
})
