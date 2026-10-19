// T067 (spec 003, SC-008): las pantallas de comidas funcionan en teléfono y en escritorio, sin
// desplazamiento horizontal, con áreas táctiles de 44 px o más y nombres largos recortados.
import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { es } from '../../src/copy/es'
import {
  clearSeededEntries,
  clearSeededFoods,
  dbQuery,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  uniqueEmail,
} from './support'

const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name)

const VIEWPORTS = [
  { name: 'teléfono', width: 375, height: 667 },
  { name: 'escritorio', width: 1280, height: 800 },
]

const LONG_NAME =
  'Galletitas rellenas sabor dulce de leche con cobertura de chocolate semiamargo edición limitada comidas e2e'

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal en ${where}`).toBeLessThanOrEqual(0)
}

/** Todo botón y enlace con aspecto de botón mide al menos 44 px de alto (SC-008). */
async function expectTouchTargets(page: Page, where: string) {
  const small = await page
    .locator(
      'button:visible, a.btn-primary:visible, a.btn-secondary:visible, label.btn-secondary:visible',
    )
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

let email = ''
const user = () => `(select id from auth.users where email = '${email}')`

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([
    {
      id: 'rm1',
      name: LONG_NAME,
      brand: 'Marca con un nombre largo para probar el recorte en pantallas chicas',
      energy: 450,
      portions: [{ name: 'Porción mediana', quantity: 30 }],
    },
  ])
})

test.afterAll(() => {
  clearSeededEntries()
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  email = uniqueEmail()
  await register(page, email)
  dbQuery(
    `select tests.create_meal_entry(${user()}, '${today()}', 'lunch', (select id from public.foods where source_item_id = 'E2E-rm1'), 80)`,
  )
  dbQuery(
    `select tests.create_manual_entry(${user()}, '${today()}', 'dinner', 'Una descripción muy larga de algo que comí en la cena para probar el recorte comidas e2e', 520)`,
  )
})

for (const viewport of VIEWPORTS) {
  test.describe(`en ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('el día, agregar y el detalle caben sin desplazamiento horizontal', async ({ page }) => {
      await page.goto(`/comidas/${today()}`)
      await expect(page.getByText(/Galletitas rellenas/).first()).toBeVisible()
      await expectNoHorizontalScroll(page, 'el día con nombres largos')
      await expectTouchTargets(page, 'el día')

      await page.goto(`/comidas/${today()}/agregar?comida=lunch`)
      await expect(page.getByRole('searchbox', { name: es.meals.add.search })).toBeVisible()
      await expectNoHorizontalScroll(page, 'agregar')
      await expectTouchTargets(page, 'agregar')

      await page.getByRole('button', { name: es.meals.add.manual }).click()
      await expectNoHorizontalScroll(page, 'la entrada manual')
      await expectTouchTargets(page, 'la entrada manual')

      await page.goto(`/comidas/${today()}`)
      await page.getByRole('link', { name: /Galletitas rellenas/ }).click()
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Galletitas rellenas')
      await expectNoHorizontalScroll(page, 'el detalle con un nombre largo')
      await expectTouchTargets(page, 'el detalle')
    })

    test('la foto, el panel de repetir y la confirmación caben y son táctiles', async ({
      page,
    }) => {
      await page.goto(`/comidas/${today()}`)
      const lunch = page.getByRole('region', { name: es.meals.names.lunch })
      await lunch.getByLabel(es.meals.photo.add).setInputFiles(fixture('con-gps.jpg'))
      await expect(lunch.getByRole('img', { name: /^Foto de Almuerzo/ })).toBeVisible()
      await lunch.getByRole('button', { name: es.meals.photo.enlarge }).click()
      await expectNoHorizontalScroll(page, 'la foto ampliada')
      await expectTouchTargets(page, 'la foto')

      await lunch.getByRole('button', { name: es.meals.repeat.action }).click()
      await expect(page.getByRole('button', { name: es.meals.repeat.next })).toBeEnabled()
      await expectNoHorizontalScroll(page, 'el panel de repetir')
      await expectTouchTargets(page, 'el panel de repetir')
      await page.getByRole('button', { name: es.meals.repeat.next }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoHorizontalScroll(page, 'la confirmación de repetir')
      await expectTouchTargets(page, 'la confirmación')
    })
  })
}
