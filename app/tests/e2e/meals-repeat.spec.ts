// T053 (spec 003, escenarios 20 y 21 del quickstart): repetir una comida de otro día.
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

function day(plusDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + plusDays)
  return new Intl.DateTimeFormat('en-CA').format(date)
}

const TODAY = day()
const YESTERDAY = day(-1)

let email = ''

const entriesOn = (date: string, meal: string) =>
  dbQuery(
    `select count(*) from public.meal_entries where user_id = (select id from auth.users where email = '${email}') and log_date = '${date}' and meal = '${meal}'`,
  )

/** Deja un desayuno de ayer con un alimento del catálogo y una entrada manual. */
async function arrive(page: Page) {
  email = uniqueEmail()
  await register(page, email)
  const user = `(select id from auth.users where email = '${email}')`
  dbQuery(
    `select tests.create_meal_entry(${user}, '${YESTERDAY}', 'breakfast', (select id from public.foods where source_item_id = 'E2E-rep1'), 100)`,
  )
  dbQuery(
    `select tests.create_manual_entry(${user}, '${YESTERDAY}', 'breakfast', 'Medialunas e2e', 300)`,
  )
}

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([{ id: 'rep1', name: 'Leche repetir e2e', energy: 60 }])
})

test.afterAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  dbQuery("update public.foods set energy_kcal = 60 where source_item_id = 'E2E-rep1'")
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await arrive(page)
})

test('escenario 20: repetir el desayuno de ayer en hoy recalcula lo que cambió y deja ayer intacto', async ({
  page,
}) => {
  // El alimento cambia después de haberlo registrado ayer.
  dbQuery("update public.foods set energy_kcal = 80 where source_item_id = 'E2E-rep1'")

  await page.goto(`/comidas/${YESTERDAY}`)
  const breakfast = page.getByRole('region', { name: es.meals.names.breakfast })
  await breakfast.getByRole('button', { name: es.meals.repeat.action }).click()
  await page.getByLabel(es.meals.repeat.day).fill(TODAY)
  await page.getByRole('button', { name: es.meals.repeat.next }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('1 se recalculan')
  await expect(dialog).toContainText('1 se copian')
  await dialog.getByRole('button', { name: es.meals.repeat.confirm }).click()

  await expect(page).toHaveURL(new RegExp(`/comidas/${TODAY}$`))
  await expect(page.getByText(es.meals.repeat.done('2 ítems'))).toBeVisible()
  const today = page.getByRole('region', { name: es.meals.names.breakfast })
  await expect(today.getByText('Leche repetir e2e')).toBeVisible()
  await expect(today.getByText('Medialunas e2e')).toBeVisible()

  const energy = (date: string) =>
    dbQuery(
      `select energy_kcal from public.meal_entries where food_name = 'Leche repetir e2e' and log_date = '${date}' and user_id = (select id from auth.users where email = '${email}')`,
    )
  expect(energy(TODAY)).toBe('80.00')
  expect(energy(YESTERDAY)).toBe('60.00')
  expect(entriesOn(YESTERDAY, 'breakfast')).toBe('2')
})

test('escenario 21: el doble clic en "Repetir" crea los ítems una sola vez', async ({ page }) => {
  await page.goto(`/comidas/${YESTERDAY}`)
  const breakfast = page.getByRole('region', { name: es.meals.names.breakfast })
  await breakfast.getByRole('button', { name: es.meals.repeat.action }).click()
  await page.getByLabel(es.meals.repeat.day).fill(TODAY)
  await page.getByRole('button', { name: es.meals.repeat.next }).click()

  await page
    .getByRole('dialog')
    .getByRole('button', { name: es.meals.repeat.confirm })
    .dblclick({ delay: 20 })
  await expect(page).toHaveURL(new RegExp(`/comidas/${TODAY}$`))
  expect(entriesOn(TODAY, 'breakfast')).toBe('2')
})
