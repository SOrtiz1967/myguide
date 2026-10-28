// T067 (spec 002, escenario 25 del quickstart): pantalla de fuentes y licencias.
import { expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail())
})

test('escenario 25: /fuentes muestra cada fuente con su licencia, atribución, fecha y cantidad', async ({
  page,
}) => {
  await page.goto('/fuentes')
  await expect(page.getByRole('heading', { level: 1, name: es.foods.sources.title })).toBeVisible()

  const off = page.getByRole('article').filter({ hasText: 'Open Food Facts' })
  await expect(off.getByRole('link', { name: 'ODbL 1.0' })).toHaveAttribute(
    'href',
    'https://opendatacommons.org/licenses/odbl/1-0/',
  )
  await expect(off).toContainText('openfoodfacts.org')
  await expect(off).toContainText(/\d+ alimentos|\d\.\d{3} alimentos/)

  const usda = page.getByRole('article').filter({ hasText: 'USDA FoodData Central' })
  await expect(usda.getByRole('link', { name: 'CC0 1.0' })).toBeVisible()
  await expect(usda).toContainText('dominio público')
})

test('desde la procedencia de un alimento se llega a las fuentes', async ({ page }) => {
  // El alimento de la muestra viene de una fuente del catálogo; basta con abrir uno cualquiera.
  await page.goto('/alimentos')
  await page.getByRole('searchbox', { name: es.foods.searchLabel }).fill('leche')
  await page.getByRole('main').getByRole('list').getByRole('link').first().click()
  await page.getByRole('link', { name: es.foods.provenance.viewSources }).click()
  await expect(page).toHaveURL(/\/fuentes$/)
  await expect(page.getByRole('heading', { level: 1, name: es.foods.sources.title })).toBeVisible()
})
