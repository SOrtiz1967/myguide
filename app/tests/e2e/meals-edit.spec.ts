// T043 (spec 003, escenarios 13 a 16 del quickstart): corregir, mover y eliminar un ítem ya registrado.
import { expect, test, type Page } from '@playwright/test'
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

const searchBox = (page: Page) => page.getByRole('searchbox', { name: es.meals.add.search })

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

function yesterday(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return new Intl.DateTimeFormat('en-CA').format(date)
}

/** Agrega un ítem del catálogo por la interfaz y abre su detalle desde el día. */
async function addAndOpen(page: Page, name: string, meal: string, grams: string) {
  await page.goto(`/comidas/${today()}/agregar?comida=${meal}`)
  await searchBox(page).fill(name.toLowerCase())
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.getByLabel(es.meals.quantity.amountGrams).fill(grams)
  await page.getByRole('button', { name: es.meals.add.confirm }).click()
  await expect(page.getByText(es.meals.addedTo[meal as 'lunch'])).toBeVisible()
  await page.goto(`/comidas/${today()}`)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

const valuesTable = (page: Page) => page.getByRole('table', { name: es.meals.entry.values })

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([
    { id: 'edit1', name: 'Arroz edicion e2e', energy: 130 },
    { id: 'edit2', name: 'Leche edicion e2e', energy: 61 },
    { id: 'edit3', name: 'Pan edicion e2e', energy: 250 },
  ])
})

test.afterAll(() => {
  clearSeededEntries()
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail())
})

test('escenario 13: cambiar la cantidad de 100 g a 200 g duplica los valores y los totales', async ({
  page,
}) => {
  await addAndOpen(page, 'Arroz edicion e2e', 'lunch', '100')
  await expect(valuesTable(page).getByRole('row', { name: /^Energía/ })).toContainText('130 kcal')

  await page.getByLabel(es.meals.quantity.amountGrams).fill('200')
  await page.getByRole('button', { name: es.meals.entry.save }).click()
  await expect(page.getByText(es.meals.entry.saved)).toBeVisible()
  await expect(valuesTable(page).getByRole('row', { name: /^Energía/ })).toContainText('260 kcal')

  await page.getByRole('link', { name: es.meals.entry.back }).click()
  await expect(page.getByRole('region', { name: es.meals.day.total })).toContainText('260 kcal')
})

test('escenario 14: mover un ítem a la cena de ayer lo saca del origen y lo muestra en el destino', async ({
  page,
}) => {
  await addAndOpen(page, 'Leche edicion e2e', 'breakfast', '200')

  await page.getByLabel(es.meals.entry.meal).selectOption('dinner')
  await page.getByLabel(es.meals.entry.day).fill(yesterday())
  await page.getByRole('button', { name: es.meals.entry.save }).click()
  await expect(page.getByText(es.meals.entry.saved)).toBeVisible()

  await page.goto(`/comidas/${today()}`)
  await expect(page.getByText('Leche edicion e2e')).toHaveCount(0)

  await page.goto(`/comidas/${yesterday()}`)
  const dinner = page.getByRole('region', { name: es.meals.names.dinner })
  await expect(dinner.getByText('Leche edicion e2e')).toBeVisible()
})

test('escenario 15: eliminar solo ocurre al confirmar', async ({ page }) => {
  await addAndOpen(page, 'Pan edicion e2e', 'snack', '50')
  const count = () =>
    dbQuery("select count(*) from public.meal_entries where food_name = 'Pan edicion e2e'")

  await page.getByRole('button', { name: es.meals.entry.delete }).click()
  const dialog = page.getByRole('dialog', { name: es.meals.entry.deleteTitle })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: es.meals.entry.cancel }).click()
  await expect(dialog).toBeHidden()
  expect(count()).toBe('1')

  await page.getByRole('button', { name: es.meals.entry.delete }).click()
  await page
    .getByRole('dialog', { name: es.meals.entry.deleteTitle })
    .getByRole('button', { name: es.meals.entry.confirmDelete })
    .click()
  await expect(page).toHaveURL(new RegExp(`/comidas/${today()}$`))
  await expect(page.getByText('Pan edicion e2e')).toHaveCount(0)
  expect(count()).toBe('0')
})

test('escenario 16: editar y eliminar el alimento no cambia lo ya registrado', async ({ page }) => {
  await addAndOpen(page, 'Arroz edicion e2e', 'dinner', '100')

  // El alimento cambia en el catálogo: el ítem conserva su instantánea.
  dbQuery(
    "update public.foods set name = 'Otro nombre', energy_kcal = 800 where source_item_id = 'E2E-edit1'",
  )
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Arroz edicion e2e' })).toBeVisible()
  await expect(valuesTable(page).getByRole('row', { name: /^Energía/ })).toContainText('130 kcal')

  // El alimento desaparece: el ítem sigue ahí y lo avisa.
  dbQuery("delete from public.foods where source_item_id = 'E2E-edit1'")
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Arroz edicion e2e' })).toBeVisible()
  await expect(page.getByText(es.meals.day.foodGone)).toBeVisible()
  await expect(valuesTable(page).getByRole('row', { name: /^Energía/ })).toContainText('130 kcal')

  // Y todavía se puede corregir la cantidad con lo que quedó guardado.
  await page.getByLabel(es.meals.quantity.amountGrams).fill('50')
  await page.getByRole('button', { name: es.meals.entry.save }).click()
  await expect(valuesTable(page).getByRole('row', { name: /^Energía/ })).toContainText('65 kcal')
})
