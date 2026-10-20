// T029 (spec 004, escenarios 8 a 12 del quickstart): ver cuánto llevo y cuánto me queda.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  dayIn,
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  uniqueEmail,
  zoneWhereItIsOneAm,
} from './support'
import { localDate, seedEntry, seedGoal } from './goals-support'

const g = es.goal

async function registerUser(page: Page) {
  const email = uniqueEmail('summary')
  await register(page, email)
  return email
}

const card = (page: Page) => page.getByRole('region', { name: g.cardTitle })

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 8: objetivo 2.000 y 1.350 registradas', async ({ page }) => {
  const email = await registerUser(page)
  seedGoal(email, 2000, localDate(-3))
  seedEntry(email, { name: 'Desayuno resumen e2e', energy: 400, meal: 'breakfast' })
  seedEntry(email, { name: 'Almuerzo resumen e2e', energy: 950 })

  await page.goto('/comidas')
  await expect(card(page)).toContainText(g.goalLine(2000))
  await expect(card(page)).toContainText(g.registered(1350, false))
  await expect(card(page).getByText('Restan 650 kcal')).toBeVisible()
  await expect(card(page).getByText('2.000 − 1.350 = 650 kcal')).toBeVisible()
  await expect(card(page).getByText('68 % del objetivo')).toBeVisible()
  // la barra es decorativa: no es un control accesible
  await expect(card(page).getByRole('progressbar')).toHaveCount(0)
})

test('escenario 9: agregar un ítem actualiza las cifras sin recargar', async ({ page }) => {
  const email = await registerUser(page)
  seedGoal(email, 2000, localDate(-3))
  seedEntry(email, { name: 'Base resumen e2e', energy: 1350 })

  await page.goto('/comidas')
  await expect(card(page).getByText('Restan 650 kcal')).toBeVisible()

  await page.goto(`/comidas/${localDate()}/agregar?comida=snack`)
  await page.getByRole('button', { name: es.meals.add.manual }).click()
  await page.getByLabel(es.meals.manual.description, { exact: false }).fill('Merienda resumen e2e')
  await page.getByLabel('Energía (kcal)', { exact: false }).fill('200')
  await page.getByRole('button', { name: es.meals.manual.save }).click()

  await expect(card(page).getByText('Restan 450 kcal')).toBeVisible()
  await expect(card(page).getByText('2.000 − 1.550 = 450 kcal')).toBeVisible()

  // eliminar el ítem vuelve a las cifras de antes
  await page.getByText('Merienda resumen e2e').click()
  await page.getByRole('button', { name: es.meals.entry.delete }).click()
  await page
    .getByRole('dialog', { name: es.meals.entry.deleteTitle })
    .getByRole('button', { name: es.meals.entry.confirmDelete })
    .click()
  await expect(page).toHaveURL(new RegExp(`/comidas/${localDate()}$`))
  await expect(card(page).getByText('Restan 650 kcal')).toBeVisible()
})

test('escenario 10: cada día muestra su total y el objetivo que regía ese día', async ({
  page,
}) => {
  const email = await registerUser(page)
  seedGoal(email, 2000, localDate(-10), new Date(Date.now() - 10 * 86400000).toISOString())
  seedGoal(email, 1800, localDate(), new Date().toISOString())
  seedEntry(email, { name: 'Hoy resumen e2e', energy: 800 })
  seedEntry(email, { name: 'Ayer resumen e2e', energy: 1500, date: localDate(-1) })

  await page.goto('/comidas')
  await expect(card(page)).toContainText(g.goalLine(1800))
  await expect(card(page).getByText('Restan 1.000 kcal')).toBeVisible()

  await page.getByRole('link', { name: /Día anterior/ }).click()
  await expect(card(page)).toContainText(g.goalLine(2000))
  await expect(card(page).getByText('Restan 500 kcal')).toBeVisible()

  await page.getByRole('link', { name: /Día siguiente/ }).click()
  await expect(card(page)).toContainText(g.goalLine(1800))
})

test('escenario 11: un día vacío con objetivo muestra el objetivo completo', async ({ page }) => {
  const email = await registerUser(page)
  seedGoal(email, 2000, localDate(-3))

  await page.goto('/comidas')
  await expect(card(page)).toContainText(g.registered(0, false))
  await expect(card(page).getByText('Restan 2.000 kcal')).toBeVisible()
  await expect(card(page).getByText('0 % del objetivo')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('escenario 12: a la una de la madrugada, el resumen del día que se cierra lleva su fecha', async ({
  page,
}) => {
  const zone = zoneWhereItIsOneAm()
  const yesterday = dayIn(zone, -1)
  const email = await registerUser(page)
  dbQuery(
    `update public.profiles set timezone = '${zone}' where user_id = (select id from auth.users where email = '${email}')`,
  )
  seedGoal(email, 2000, dayIn(zone, -5))
  seedEntry(email, { name: 'Cena que se cierra e2e', energy: 700, date: yesterday, meal: 'dinner' })

  await page.goto(`/comidas/${yesterday}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/\d+ de /)
  await expect(card(page)).toContainText(g.goalLine(2000))
  await expect(card(page).getByText('Restan 1.300 kcal')).toBeVisible()
  await expect(card(page).getByText('2.000 − 700 = 1.300 kcal')).toBeVisible()
})
