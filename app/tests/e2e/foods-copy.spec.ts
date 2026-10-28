// T056 (spec 002, escenarios 16 a 18 del quickstart): crear mi versión de un alimento del catálogo.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededFoods,
  dbQuery,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  uniqueEmail,
} from './support'

const field = (page: Page, text: string) => page.getByLabel(text, { exact: false })
const energyRow = (page: Page) => page.getByRole('row', { name: /Energía/ })

test.beforeAll(() => {
  clearSeededFoods()
  seedCatalogFoods([
    {
      id: 'copy1',
      name: 'Original copiable e2e',
      energy: 120,
      portions: [{ name: 'Taza', quantity: 150 }],
    },
  ])
})

test.afterAll(() => {
  clearSeededFoods()
  dbQuery("delete from public.foods where name = 'Original copiable e2e' and origin = 'own'")
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenarios 16, 17 y 18: la copia es editable, el original no cambia y una recarga del catálogo no la afecta', async ({
  page,
  browser,
}) => {
  await register(page, uniqueEmail())
  const originalId = dbQuery("select id from public.foods where source_item_id = 'E2E-copy1'")

  // 16: crear mi versión
  await page.goto(`/alimentos/${originalId}`)
  await page.getByRole('button', { name: es.foods.actions.createMine }).click()
  await expect(page).toHaveURL(/\/editar$/)
  await expect(page.getByText(es.foods.form.copyCreated)).toBeVisible()
  await expect(field(page, 'Energía (kcal)')).toHaveValue('120')
  await expect(page.getByLabel(es.foods.form.portionName)).toHaveValue('Taza')

  // 17: editar la copia
  await field(page, 'Energía (kcal)').fill('150')
  await page.getByRole('button', { name: es.foods.actions.save }).click()
  await expect(page.getByText(es.foods.form.saved)).toBeVisible()
  await expect(energyRow(page)).toContainText('150 kcal')
  await expect(page.getByText(/Propio, basado en/)).toBeVisible()
  await page.getByRole('link', { name: 'Original copiable e2e' }).click()
  await expect(energyRow(page)).toContainText('120 kcal')

  // en la búsqueda se distinguen el original y la copia
  await page.goto('/alimentos?q=original+copiable+e2e')
  const list = page.getByRole('main').getByRole('list')
  await expect(list.getByText(es.foods.originBadge.catalog)).toBeVisible()
  await expect(list.getByText(es.foods.originBadge.copy)).toBeVisible()

  // otra cuenta ve el original intacto y no ve la copia
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await stubTurnstile(otherPage)
  await register(otherPage, uniqueEmail('otra'))
  await otherPage.goto('/alimentos?q=original+copiable+e2e')
  await expect(otherPage.getByRole('main').getByRole('list').getByRole('link')).toHaveCount(1)
  await otherPage.getByRole('link', { name: /Original copiable e2e/ }).click()
  await expect(energyRow(otherPage)).toContainText('120 kcal')
  await other.close()

  // 18: una nueva importación cambia el original; la copia conserva sus valores
  dbQuery("update public.foods set energy_kcal = 130 where source_item_id = 'E2E-copy1'")
  await page.goto(`/alimentos/${originalId}`)
  await expect(energyRow(page)).toContainText('130 kcal')
  await page.goto('/alimentos?q=original+copiable+e2e')
  await page.getByRole('main').getByRole('list').getByText(es.foods.originBadge.copy).click()
  await expect(energyRow(page)).toContainText('150 kcal')
})
