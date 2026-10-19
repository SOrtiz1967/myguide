// T038 (spec 003, escenarios 10, 11 y 12 del quickstart): registrar algo que no está en el catálogo.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededEntries,
  clearSeededFoods,
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  uniqueEmail,
} from './support'

const field = (page: Page, text: string) => page.getByLabel(text, { exact: false })

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  dbQuery("delete from public.foods where origin = 'own' and name like '%e2e%'")
})

test.afterAll(() => {
  clearSeededEntries()
  dbQuery("delete from public.foods where origin = 'own' and name like '%e2e%'")
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail())
})

test('escenario 10: "Torta, 350 kcal" sin macronutrientes se registra como Manual y suma al día', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}/agregar?comida=extra`)
  await page.getByRole('button', { name: es.meals.add.manual }).click()
  await field(page, es.meals.manual.description).fill('Torta de cumpleaños e2e')
  await field(page, es.meals.manual.quantityText).fill('1 porción')
  await field(page, 'Energía (kcal)').fill('350')
  await page.getByRole('button', { name: es.meals.manual.save }).click()

  await expect(page.getByText(es.meals.addedTo.extra)).toBeVisible()
  const extra = page.getByRole('region', { name: es.meals.names.extra })
  await expect(extra.getByText('Torta de cumpleaños e2e')).toBeVisible()
  await expect(extra.getByText(es.meals.origin.manual)).toBeVisible()
  await expect(extra.getByText(/1 porción · 350 kcal/)).toBeVisible()

  const total = page.getByRole('region', { name: es.meals.day.total })
  await expect(total).toContainText('350 kcal')
  await expect(total).toContainText('sin dato') // proteínas, carbohidratos y grasas no informados
})

test('escenario 11: valores imposibles se rechazan con un mensaje claro', async ({ page }) => {
  await page.goto(`/comidas/${today()}/agregar?comida=lunch`)
  await page.getByRole('button', { name: es.meals.add.manual }).click()
  await field(page, es.meals.manual.description).fill('Imposible e2e')
  await field(page, 'Energía (kcal)').fill('6000')
  await field(page, 'Proteínas (g)').fill('-4')
  await page.getByRole('button', { name: es.meals.manual.save }).click()

  await expect(page.getByText(es.meals.manual.errors.outOfRange('5.000'))).toBeVisible()
  await expect(page.getByText(es.meals.manual.errors.negative)).toBeVisible()
  expect(
    dbQuery("select count(*) from public.meal_entries where food_name = 'Imposible e2e'"),
  ).toBe('0')
})

test('escenario 12: guardar una entrada manual como alimento propio, sin cambiar el ítem', async ({
  page,
}) => {
  await page.goto(`/comidas/${today()}/agregar?comida=snack`)
  await page.getByRole('button', { name: es.meals.add.manual }).click()
  await field(page, es.meals.manual.description).fill('Alfajor casero e2e')
  await field(page, es.meals.manual.quantityText).fill('1 unidad')
  await field(page, 'Energía (kcal)').fill('300')
  await field(page, 'Proteínas (g)').fill('4')
  await page.getByRole('button', { name: es.meals.manual.save }).click()
  await expect(page.getByText(es.meals.addedTo.snack)).toBeVisible()

  await page.getByRole('button', { name: es.meals.saveAsFood.action }).click()
  await field(page, es.meals.saveAsFood.amountGrams).fill('60')
  const preview = page.getByRole('table', { name: /por 100 g/ })
  await expect(preview.getByRole('row', { name: /^Energía/ })).toContainText('500 kcal')
  await page.getByRole('button', { name: es.meals.saveAsFood.save }).click()
  await expect(page.getByText(es.meals.saveAsFood.saved)).toBeVisible()

  // aparece en "Mis alimentos" con una porción de 60 g
  await page.getByRole('link', { name: es.meals.saveAsFood.viewFood }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alfajor casero e2e' })).toBeVisible()
  await expect(page.getByText('1 unidad: 60 g')).toBeVisible()
  await expect(page.getByRole('row', { name: /Energía/ })).toContainText('500 kcal')

  // el ítem registrado no cambió
  const entry = dbQuery(
    "select energy_kcal || '|' || origin from public.meal_entries where food_name = 'Alfajor casero e2e'",
  )
  expect(entry).toBe('300.00|manual')
})
