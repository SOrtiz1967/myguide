// T022 (spec 002, escenarios 1 a 8 y 26 del quickstart): buscar alimentos y ver su detalle.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededFoods,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  uniqueEmail,
} from './support'

const searchBox = (page: Page) => page.getByRole('searchbox', { name: es.foods.searchLabel })

test.beforeAll(() => {
  clearSeededFoods()
  seedCatalogFoods([
    { id: '1', name: 'Dulce de leche e2e', brand: 'La Serenisima', energy: 315 },
    { id: '2', name: 'Leche entera e2e', energy: 61, fiber: null },
    { id: '3', name: 'Leche descremada e2e', energy: 35 },
    {
      id: '4',
      name: 'Arroz con porciones e2e',
      energy: 130,
      portions: [
        { name: 'Taza', quantity: 158 },
        { name: 'Cucharada', quantity: 12.5 },
      ],
    },
    ...Array.from({ length: 25 }, (_, i) => ({
      id: `g${i}`,
      name: `Galletita e2eg ${String(i).padStart(2, '0')}`,
      energy: 400,
    })),
  ])
})

test.afterAll(() => {
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail())
})

test('escenarios 1 y 2: busca "leche" y encuentra lo mismo sin importar acentos ni mayúsculas', async ({
  page,
}) => {
  await page.getByRole('link', { name: es.foods.navLink }).click()
  await searchBox(page).fill('leche e2e')
  const list = page.getByRole('main').getByRole('list')
  await expect(list.getByRole('link', { name: /Leche entera e2e/ })).toBeVisible()
  await expect(list.getByRole('link', { name: /Dulce de leche e2e/ })).toBeVisible()
  await expect(list.getByText('61 kcal').first()).toBeVisible()
  await expect(list.getByText(es.foods.originBadge.catalog).first()).toBeVisible()

  await searchBox(page).fill('DULCE de léche E2E')
  await expect(list.getByRole('link', { name: /Dulce de leche e2e/ })).toBeVisible()
  await expect(list.getByRole('link', { name: /Leche entera/ })).toHaveCount(0)
})

test('escenarios 3, 4 y 5: detalle completo, fibra "sin dato" y procedencia', async ({ page }) => {
  await page.goto('/alimentos?q=leche+entera+e2e')
  await page.getByRole('link', { name: /Leche entera e2e/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Leche entera e2e' })).toBeVisible()
  await expect(page.getByText(/por 100 g/)).toBeVisible()
  await expect(page.getByRole('row', { name: /Energía/ })).toContainText('61 kcal')
  await expect(page.getByRole('row', { name: /Proteínas/ })).toContainText('3,3 g')
  await expect(page.getByRole('row', { name: /Fibra/ })).toContainText(es.foods.nutrition.missing)
  await expect(page.getByRole('row', { name: /Fibra/ })).not.toContainText(/\b0\b/)
  await expect(
    page.getByText('Del catálogo · USDA FoodData Central · código E2E-2 · importado el 18/10/2026'),
  ).toBeVisible()
  await expect(page.getByText(es.foods.portions.none)).toBeVisible()
})

test('escenario 3: las porciones se muestran aparte de los valores por 100 g', async ({ page }) => {
  await page.goto('/alimentos?q=arroz+con+porciones')
  await page.getByRole('link', { name: /Arroz con porciones e2e/ }).click()
  await expect(page.getByText('Taza: 158 g')).toBeVisible()
  await expect(page.getByText('Cucharada: 12,5 g')).toBeVisible()
})

test('escenario 6: una búsqueda sin resultados ofrece crear lo buscado', async ({ page }) => {
  await page.goto('/alimentos')
  await searchBox(page).fill('quinoa inexistente')
  await expect(page.getByText(es.foods.emptyTitle)).toBeVisible()
  await expect(
    page.getByRole('button', { name: es.foods.createNamed('quinoa inexistente') }),
  ).toBeVisible()
})

test('escenario 7: "Ver más" agrega resultados sin perder los anteriores', async ({ page }) => {
  await page.goto('/alimentos')
  await searchBox(page).fill('galletita e2eg')
  const list = page.getByRole('main').getByRole('list')
  await expect(list.getByRole('link')).toHaveCount(20)
  await expect(page.getByText('25 resultados')).toBeVisible()
  await page.getByRole('button', { name: es.foods.loadMore }).click()
  await expect(list.getByRole('link')).toHaveCount(25)
  await expect(page.getByRole('button', { name: es.foods.loadMore })).toHaveCount(0)
})

test('escenario 8: las pestañas filtran por origen y se conservan al ir al detalle y volver', async ({
  page,
}) => {
  await page.goto('/alimentos')
  await searchBox(page).fill('leche e2e')
  await expect(page.getByRole('link', { name: /Leche entera e2e/ })).toBeVisible()

  await page.getByRole('tab', { name: es.foods.tabs.own }).click()
  await expect(page.getByText(es.foods.emptyTitle)).toBeVisible()
  await page.getByRole('tab', { name: es.foods.tabs.catalog }).click()
  await expect(page.getByRole('link', { name: /Leche entera e2e/ })).toBeVisible()
  await expect(page).toHaveURL(/origen=catalogo/)

  await page.getByRole('link', { name: /Leche entera e2e/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Leche entera e2e' })).toBeVisible()
  await page.goBack()
  await expect(searchBox(page)).toHaveValue('leche e2e')
  await expect(page.getByRole('tab', { name: es.foods.tabs.catalog })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('link', { name: /Leche entera e2e/ })).toBeVisible()
})

test('escenario 26 (FR-008, SC-009): buscar y consultar no usa ningún servicio de terceros', async ({
  page,
}) => {
  const blocked: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    const local = ['localhost', '127.0.0.1'].includes(url.hostname)
    if (local) return route.continue()
    blocked.push(url.href)
    return route.abort()
  })

  await page.goto('/alimentos')
  await searchBox(page).fill('leche entera e2e')
  await page.getByRole('link', { name: /Leche entera e2e/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Leche entera e2e' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Energía/ })).toContainText('61 kcal')
  expect(blocked, `peticiones a terceros: ${blocked.join(', ')}`).toEqual([])
})
