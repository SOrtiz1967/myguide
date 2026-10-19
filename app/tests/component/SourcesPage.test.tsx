// T066 (spec 002, FR-012): pantalla de fuentes con licencia, atribución, fecha y cantidad.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchSources, type FoodSource } from '../../src/features/foods/api'
import { SourcesPage } from '../../src/features/foods/SourcesPage'

vi.mock('../../src/features/foods/api', () => ({ fetchSources: vi.fn() }))
const mockedFetch = vi.mocked(fetchSources)

const off: FoodSource = {
  id: 's1',
  slug: 'open-food-facts',
  name: 'Open Food Facts',
  license_name: 'ODbL 1.0',
  license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution:
    'Datos de productos de Open Food Facts (openfoodfacts.org), bajo la licencia ODbL 1.0.',
  source_url: 'https://world.openfoodfacts.org',
  last_imported_at: '2026-10-18T12:00:00Z',
  food_count: 3929,
}
const usda: FoodSource = {
  id: 's2',
  slug: 'usda-fdc',
  name: 'USDA FoodData Central',
  license_name: 'CC0 1.0',
  license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  attribution: 'Datos de composición de alimentos de USDA FoodData Central, de dominio público.',
  source_url: 'https://fdc.nal.usda.gov',
  last_imported_at: null,
  food_count: 0,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SourcesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue([off, usda])
})

describe('SourcesPage', () => {
  it('lista cada fuente con licencia, atribución, fecha de importación y cantidad', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { level: 1, name: es.foods.sources.title }),
    ).toBeVisible()
    const card = (await screen.findByRole('heading', { name: 'Open Food Facts' })).closest(
      'article',
    )!

    expect(within(card).getByRole('link', { name: 'ODbL 1.0' })).toHaveAttribute(
      'href',
      'https://opendatacommons.org/licenses/odbl/1-0/',
    )
    expect(within(card).getByText(off.attribution)).toBeVisible()
    expect(within(card).getByText('18/10/2026')).toBeVisible()
    expect(within(card).getByText('3.929 alimentos')).toBeVisible()
    expect(within(card).getByRole('link', { name: es.foods.sources.siteLink })).toHaveAttribute(
      'href',
      'https://world.openfoodfacts.org',
    )
  })

  it('una fuente que todavía no se importó lo dice', async () => {
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'USDA FoodData Central' })).closest(
      'article',
    )!
    expect(within(card).getByText(es.foods.sources.neverImported)).toBeVisible()
    expect(within(card).getByText('0 alimentos')).toBeVisible()
  })

  it('los enlaces externos abren en otra pestaña de forma segura', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'ODbL 1.0' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('sin fuentes muestra el estado vacío', async () => {
    mockedFetch.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(es.foods.sources.empty)).toBeVisible()
  })

  it('muestra la carga', async () => {
    mockedFetch.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(await screen.findByRole('status')).toBeVisible()
  })

  it('si falla, avisa y permite reintentar', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([off])
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(es.foods.sources.error)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('heading', { name: 'Open Food Facts' })).toBeVisible()
  })
})
