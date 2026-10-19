// T023 (spec 003, escenarios 1 a 6 del quickstart): agregar alimentos a una comida y verlos en el día.
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
const confirm = (page: Page) => page.getByRole('button', { name: es.meals.add.confirm })

function today(): string {
  // El mismo corte que usa la aplicación: el día en la zona horaria del navegador de la prueba.
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([
    {
      id: 'meal1',
      name: 'Arroz comidas e2e',
      energy: 130,
      fiber: null,
      portions: [{ name: '1 taza', quantity: 158 }],
    },
    { id: 'meal2', name: 'Leche comidas e2e', energy: 61 },
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

test('escenario 1: agregar "Arroz, 150 g" al almuerzo lo muestra en el día con valores para 150 g', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}/agregar?comida=lunch`)
  await searchBox(page).fill('arroz comidas e2e')
  await page.getByRole('button', { name: /Arroz comidas e2e/ }).click()

  const amount = page.getByLabel(es.meals.quantity.amountGrams)
  await amount.fill('150')
  await expect(page.getByRole('row', { name: /^Energía/ })).toContainText('195 kcal')
  await confirm(page).click()

  await expect(page.getByText(es.meals.addedTo.lunch)).toBeVisible()
  const lunch = page.getByRole('region', { name: es.meals.names.lunch })
  await expect(lunch.getByText('Arroz comidas e2e')).toBeVisible()
  await expect(lunch.getByText(/150 g · 195 kcal/)).toBeVisible()
  await expect(lunch.getByText(es.meals.origin.catalog)).toBeVisible()
})

test('escenarios 2 y 3: con porciones la cantidad equivale en gramos y el faltante dice "sin dato"', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}/agregar?comida=dinner`)
  await searchBox(page).fill('arroz comidas e2e')
  await page.getByRole('button', { name: /Arroz comidas e2e/ }).click()

  await page.getByLabel(es.meals.quantity.measure).selectOption({ label: '1 taza (158 g)' })
  await page.getByLabel(es.meals.quantity.amountPortions).fill('1,5')
  await expect(page.getByText(es.meals.quantity.equivalent('237 g'))).toBeVisible()
  await expect(page.getByRole('row', { name: /^Fibra/ })).toContainText('sin dato')
  await confirm(page).click()

  const dinner = page.getByRole('region', { name: es.meals.names.dinner })
  await expect(dinner.getByText(/1,5 × 1 taza \(237 g\)/)).toBeVisible()
  const total = page.getByRole('region', { name: es.meals.day.total })
  await expect(total).toContainText('308 kcal')
})

test('escenario 4: el doble clic en "Agregar" crea un solo ítem', async ({ page }) => {
  await page.goto(`/comidas/${today()}/agregar?comida=snack`)
  await searchBox(page).fill('leche comidas e2e')
  await page.getByRole('button', { name: /Leche comidas e2e/ }).click()
  await page.getByLabel(es.meals.quantity.amountGrams).fill('200')
  await confirm(page).dblclick()
  await expect(page.getByText(es.meals.addedTo.snack)).toBeVisible()
  const count = dbQuery(
    "select count(*) from public.meal_entries where food_name = 'Leche comidas e2e'",
  )
  expect(count).toBe('1')
})

test('escenario 5: cortar la red al agregar avisa que no se guardó y conserva lo elegido', async ({
  page,
  context,
}) => {
  await page.goto(`/comidas/${today()}/agregar?comida=snack`)
  await searchBox(page).fill('leche comidas e2e')
  await page.getByRole('button', { name: /Leche comidas e2e/ }).click()
  await page.getByLabel(es.meals.quantity.amountGrams).fill('250')

  await context.setOffline(true)
  await confirm(page).click()
  await expect(page.getByRole('alert').filter({ hasText: es.errors.offline })).toBeVisible()
  await expect(page.getByText(es.meals.addedTo.snack)).toHaveCount(0)
  await expect(page.getByLabel(es.meals.quantity.amountGrams)).toHaveValue('250')

  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText(es.meals.add.draftRestored)).toBeVisible()
  await expect(page.getByLabel(es.meals.quantity.amountGrams)).toHaveValue('250')
})

test('escenario 6: un alimento ya registrado vuelve como reciente con su última cantidad, en 2 toques', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}/agregar?comida=breakfast`)
  await searchBox(page).fill('leche comidas e2e')
  await page.getByRole('button', { name: /Leche comidas e2e/ }).click()
  await page.getByLabel(es.meals.quantity.amountGrams).fill('180')
  await confirm(page).click()
  await expect(page.getByText(es.meals.addedTo.breakfast)).toBeVisible()

  await page.goto(`/comidas/${today()}/agregar?comida=snack`)
  const recent = page.getByRole('button', { name: /Leche comidas e2e/ })
  await expect(recent).toContainText('180 g')
  await recent.click() // toque 1
  await expect(page.getByLabel(es.meals.quantity.amountGrams)).toHaveValue('180')
  await confirm(page).click() // toque 2
  await expect(page.getByText(es.meals.addedTo.snack)).toBeVisible()
  const day = page.getByRole('region', { name: es.meals.names.snack })
  await expect(day.getByText(/180 g/)).toBeVisible()
})
