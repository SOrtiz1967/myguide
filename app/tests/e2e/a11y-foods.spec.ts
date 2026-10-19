// T069 (spec 002, FR-030): accesibilidad de las pantallas de alimentos (axe) y recorrido por teclado.
import AxeBuilder from '@axe-core/playwright'
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

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    ),
    `Violaciones de accesibilidad en ${name}`,
  ).toEqual([])
}

test.beforeAll(() => {
  clearSeededFoods()
  seedCatalogFoods([
    {
      id: 'a11y1',
      name: 'Alimento accesible e2e',
      brand: 'Marca',
      energy: 200,
      portions: [{ name: 'Taza', quantity: 100 }],
    },
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

test('axe: búsqueda, detalle, formulario, edición y fuentes no tienen violaciones graves', async ({
  page,
}) => {
  await page.goto('/alimentos?q=alimento+accesible+e2e')
  await expect(page.getByRole('link', { name: /Alimento accesible e2e/ })).toBeVisible()
  await expectNoViolations(page, '/alimentos con resultados')

  await page.goto('/alimentos?q=nada+que+encontrar+xyz')
  await expect(page.getByText(es.foods.emptyTitle)).toBeVisible()
  await expectNoViolations(page, '/alimentos vacío')

  const id = dbQuery("select id from public.foods where source_item_id = 'E2E-a11y1'")
  await page.goto(`/alimentos/${id}`)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Alimento accesible e2e' }),
  ).toBeVisible()
  await expectNoViolations(page, 'detalle de un alimento del catálogo')

  await page.goto('/alimentos/nuevo')
  await page.getByRole('button', { name: es.foods.actions.addPortion }).click()
  await page.getByRole('button', { name: es.foods.actions.save }).click()
  await expect(page.getByText(es.foods.errors.nameRequired)).toBeVisible()
  await expectNoViolations(page, 'formulario con errores')

  await page.getByLabel('Nombre', { exact: true }).fill('Para editar a11y')
  await page.getByLabel('Energía (kcal)', { exact: false }).fill('100')
  await page.getByLabel(es.foods.form.portionName).fill('Porcion')
  await page.getByLabel(`${es.foods.form.portionAmount} (g)`).fill('10')
  await page.getByRole('button', { name: es.foods.actions.save }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Para editar a11y' })).toBeVisible()
  await expectNoViolations(page, 'detalle de un alimento propio')

  await page.getByRole('link', { name: es.foods.actions.edit }).click()
  await expect(page.getByRole('heading', { level: 1, name: es.foods.form.editTitle })).toBeVisible()
  await expectNoViolations(page, 'edición')

  await page.goto('/fuentes')
  await expect(page.getByRole('heading', { level: 1, name: es.foods.sources.title })).toBeVisible()
  await expectNoViolations(page, '/fuentes')
})

test('teclado: las pestañas se recorren con las flechas y los resultados con Tab', async ({
  page,
}) => {
  await page.goto('/alimentos?q=alimento+accesible+e2e')
  await expect(page.getByRole('link', { name: /Alimento accesible e2e/ })).toBeVisible()

  await page.getByRole('tab', { name: es.foods.tabs.all }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: es.foods.tabs.catalog })).toBeFocused()
  await expect(page.getByRole('tab', { name: es.foods.tabs.catalog })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: es.foods.tabs.own })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(page.getByRole('tab', { name: es.foods.tabs.all })).toBeFocused()

  // Tab sale de las pestañas (solo la activa está en el orden de tabulación) y llega al primer resultado.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: /Alimento accesible e2e/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Alimento accesible e2e' }),
  ).toBeVisible()
})

test('teclado: el diálogo de confirmación atrapa el foco, Escape cancela y el foco vuelve', async ({
  page,
}) => {
  await page.goto('/alimentos/nuevo')
  await page.getByLabel('Nombre', { exact: true }).fill('A eliminar a11y')
  await page.getByLabel('Energía (kcal)', { exact: false }).fill('100')
  await page.getByRole('button', { name: es.foods.actions.save }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'A eliminar a11y' })).toBeVisible()

  const trigger = page.getByRole('button', { name: es.foods.actions.delete })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: es.foods.form.deleteTitle })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: es.foods.actions.cancel })).toBeFocused()
  await expectNoViolations(page, 'diálogo de confirmación')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: es.foods.actions.confirmDelete })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: es.foods.actions.cancel })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
