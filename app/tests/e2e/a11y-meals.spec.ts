// T066 (spec 003): accesibilidad de las pantallas de comidas (axe) y recorrido por teclado.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { es } from '../../src/copy/es'
import {
  clearSeededEntries,
  clearSeededFoods,
  dayIn,
  dbQuery,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  uniqueEmail,
  zoneWhereItIsOneAm,
} from './support'

const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name)

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

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

let email = ''
const user = () => `(select id from auth.users where email = '${email}')`

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([
    {
      id: 'am1',
      name: 'Arroz accesible e2e',
      brand: 'Marca',
      energy: 130,
      portions: [{ name: '1 taza', quantity: 158 }],
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
    `select tests.create_meal_entry(${user()}, '${today()}', 'lunch', (select id from public.foods where source_item_id = 'E2E-am1'), 150)`,
  )
  dbQuery(
    `select tests.create_manual_entry(${user()}, '${today()}', 'snack', 'Alfajor accesible e2e', 300)`,
  )
})

test('axe: el día, agregar, el detalle y la foto no tienen violaciones graves', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}`)
  await expect(page.getByText('Arroz accesible e2e')).toBeVisible()
  await expectNoViolations(page, 'el día con ítems')

  await page.goto(`/comidas/${dayIn('UTC', -30)}`)
  await expect(page.getByText(es.meals.day.empty)).toBeVisible()
  await expectNoViolations(page, 'un día vacío')

  await page.goto(`/comidas/${today()}/agregar?comida=lunch`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText(/Arroz accesible e2e/).first()).toBeVisible()
  await expectNoViolations(page, 'agregar con recientes')

  await page.getByRole('searchbox', { name: es.meals.add.search }).fill('arroz accesible')
  await page
    .getByRole('button', { name: /Arroz accesible e2e/ })
    .last()
    .click()
  await expect(page.getByLabel(es.meals.quantity.amountGrams)).toBeVisible()
  await expectNoViolations(page, 'agregar con un alimento elegido')

  await page.goto(`/comidas/${today()}/agregar?comida=dinner`)
  await page.getByRole('button', { name: es.meals.add.manual }).click()
  await page.getByRole('button', { name: es.meals.manual.save }).click()
  await expect(page.getByText(es.meals.manual.errors.descriptionRequired)).toBeVisible()
  await expectNoViolations(page, 'entrada manual con errores')

  await page.goto(`/comidas/${today()}`)
  await page.getByRole('link', { name: /Arroz accesible e2e/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Arroz accesible e2e' })).toBeVisible()
  await expectNoViolations(page, 'detalle de un ítem del catálogo')

  await page.goto(`/comidas/${today()}`)
  await page.getByRole('link', { name: /Alfajor accesible e2e/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alfajor accesible e2e' })).toBeVisible()
  await expectNoViolations(page, 'detalle de un ítem manual')

  await page.goto(`/comidas/${today()}`)
  const lunch = page.getByRole('region', { name: es.meals.names.lunch })
  await lunch.getByLabel(es.meals.photo.add).setInputFiles(fixture('con-gps.jpg'))
  await expect(lunch.getByRole('img', { name: /^Foto de Almuerzo/ })).toBeVisible()
  await expectNoViolations(page, 'una comida con foto')
})

test('axe: el aviso del día que se cierra y el diálogo de repetir', async ({ page }) => {
  const zone = zoneWhereItIsOneAm()
  dbQuery(`update public.profiles set timezone = '${zone}' where user_id = ${user()}`)
  dbQuery(
    `select tests.create_meal_entry(${user()}, '${dayIn(zone, -1)}', 'dinner', (select id from public.foods where source_item_id = 'E2E-am1'), 100)`,
  )
  await page.goto('/comidas')
  await expect(page.getByRole('button', { name: es.meals.day.startToday })).toBeVisible()
  await expectNoViolations(page, 'el día que se cierra')

  const dinner = page.getByRole('region', { name: es.meals.names.dinner })
  await dinner.getByRole('button', { name: es.meals.repeat.action }).click()
  await expect(page.getByRole('button', { name: es.meals.repeat.next })).toBeEnabled()
  await expectNoViolations(page, 'el panel de repetir')
  await page.getByRole('button', { name: es.meals.repeat.next }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoViolations(page, 'la confirmación de repetir')
})

test('teclado: la navegación entre días y el selector de cantidad se usan sin ratón', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}`)
  await expect(page.getByText('Arroz accesible e2e')).toBeVisible()
  const previous = page.getByRole('link', { name: /^Día anterior/ })
  await previous.focus()
  await page.keyboard.press('Enter')
  await expect(page).not.toHaveURL(new RegExp(`/comidas/${today()}$`))

  await page.goto(`/comidas/${today()}/agregar?comida=lunch`)
  await page.getByRole('searchbox', { name: es.meals.add.search }).fill('arroz accesible')
  await page
    .getByRole('button', { name: /Arroz accesible e2e/ })
    .last()
    .focus()
  await page.keyboard.press('Enter')
  const amount = page.getByLabel(es.meals.quantity.amountGrams)
  await expect(amount).toBeVisible()
  await amount.focus()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('250')
  await expect(page.getByRole('row', { name: /^Energía/ })).toContainText('325 kcal')
})

test('teclado: el diálogo de eliminar atrapa el foco, Escape cancela y el foco vuelve', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}`)
  await page.getByRole('link', { name: /Arroz accesible e2e/ }).click()
  const trigger = page.getByRole('button', { name: es.meals.entry.delete })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: es.meals.entry.deleteTitle })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: es.meals.entry.cancel })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: es.meals.entry.confirmDelete })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: es.meals.entry.cancel })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
