// T070 (spec 002, SC-010, FR-030): las pantallas de alimentos funcionan en teléfono y en escritorio,
// sin desplazamiento horizontal y con áreas táctiles de 44 px o más.
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

const VIEWPORTS = [
  { name: 'teléfono', width: 375, height: 667 },
  { name: 'escritorio', width: 1280, height: 800 },
]

const LONG_NAME =
  'Galletitas rellenas sabor dulce de leche con cobertura de chocolate semiamargo y chips crocantes edición limitada e2e'

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal en ${where}`).toBeLessThanOrEqual(0)
}

/** Todo botón, pestaña y enlace con aspecto de botón mide al menos 44 px de alto (SC-010). */
async function expectTouchTargets(page: Page, where: string) {
  const small = await page
    .locator('button:visible, [role="tab"]:visible, a.btn-primary:visible, a.btn-secondary:visible')
    .evaluateAll((elements) =>
      elements
        .map((el) => ({
          text: (el.textContent ?? '').trim().slice(0, 30),
          h: el.getBoundingClientRect().height,
        }))
        .filter((item) => item.h < 43.5),
    )
  expect(small, `áreas táctiles menores a 44 px en ${where}`).toEqual([])
}

test.beforeAll(() => {
  clearSeededFoods()
  seedCatalogFoods([
    {
      id: 'resp1',
      name: LONG_NAME,
      brand: 'Marca con un nombre largo para probar el recorte en pantallas chicas',
      energy: 450,
      portions: [{ name: 'Porción mediana', quantity: 30 }],
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

for (const viewport of VIEWPORTS) {
  test.describe(`en ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('búsqueda, detalle, formulario y fuentes caben sin desplazamiento horizontal', async ({
      page,
    }) => {
      await page.goto('/alimentos?q=galletitas+rellenas+e2e')
      await expect(page.getByRole('list').getByRole('link').first()).toBeVisible()
      await expectNoHorizontalScroll(page, 'búsqueda con un nombre largo')
      await expectTouchTargets(page, 'búsqueda')

      const id = dbQuery("select id from public.foods where source_item_id = 'E2E-resp1'")
      await page.goto(`/alimentos/${id}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Galletitas rellenas')
      await expectNoHorizontalScroll(page, 'detalle con un nombre largo')
      await expectTouchTargets(page, 'detalle')

      await page.goto('/alimentos/nuevo')
      await page.getByRole('button', { name: es.foods.actions.addPortion }).click()
      await expectNoHorizontalScroll(page, 'formulario')
      await expectTouchTargets(page, 'formulario')

      await page.goto('/fuentes')
      await expect(
        page.getByRole('heading', { level: 1, name: es.foods.sources.title }),
      ).toBeVisible()
      await expectNoHorizontalScroll(page, 'fuentes')
      await expectTouchTargets(page, 'fuentes')
    })

    test('se puede crear un alimento completo con el teclado de la pantalla', async ({ page }) => {
      await page.goto('/alimentos/nuevo')
      await page.getByLabel('Nombre', { exact: false }).fill('Creado en pantalla chica e2e')
      await page.getByLabel('Energía (kcal)', { exact: false }).fill('321')
      await page.getByRole('button', { name: es.foods.actions.save }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Creado en pantalla chica e2e' }),
      ).toBeVisible()
      await expectNoHorizontalScroll(page, 'detalle recién creado')
    })
  })
}
