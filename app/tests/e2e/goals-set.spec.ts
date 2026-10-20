// T021 (spec 004, escenarios 1 a 7 del quickstart): fijar el objetivo de energía diaria.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  dbQuery,
  login,
  PASSWORD,
  register,
  resetRateLimits,
  stubTurnstile,
  uniqueEmail,
} from './support'

const g = es.goal

function localDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return new Intl.DateTimeFormat('en-CA').format(date)
}

function userId(email: string): string {
  return dbQuery(`select id from auth.users where email = '${email}'`)
}

function seedEntry(email: string, name: string, energy: number) {
  dbQuery(
    `insert into public.meal_entries (user_id, log_date, meal, origin, food_name, energy_kcal) values ('${userId(email)}', '${localDate()}', 'lunch', 'manual', '${name}', ${energy})`,
  )
}

/** Los valores guardados de la cuenta, del más viejo al más nuevo ('' = se quitó). */
function savedGoals(email: string): string[] {
  const rows = dbQuery(
    `select coalesce(kcal::text, '') from public.energy_goals where user_id = '${userId(email)}' order by created_at`,
  )
  return rows === '' ? [] : rows.split('\n')
}

async function registerUser(page: Page) {
  const email = uniqueEmail('goal')
  await register(page, email)
  return email
}

const field = (page: Page) => page.getByLabel(g.page.fieldLabel, { exact: false })
const saveButton = (page: Page) => page.getByRole('button', { name: g.page.save })

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenarios 1 y 2: sin objetivo no hay restantes; fijar 2.000 en tres interacciones', async ({
  page,
}) => {
  const email = await registerUser(page)
  seedEntry(email, 'Guiso objetivo e2e', 1350)

  await page.goto('/comidas')
  const card = page.getByRole('region', { name: g.cardTitle })
  await expect(card).toContainText(g.registered(1350, false))
  await expect(card).not.toContainText(/restan/i)
  await expect(card).not.toContainText('%')
  await expect(card.getByRole('progressbar')).toHaveCount(0)

  // 1) abrir el objetivo desde la invitación, 2) escribir el valor, 3) guardar
  await card.getByRole('link', { name: g.invite }).click()
  await expect(page).toHaveURL(new RegExp(`/objetivo\\?volver=${localDate()}$`))
  await field(page).fill('2000')
  await saveButton(page).click()

  await expect(page).toHaveURL(new RegExp(`/comidas/${localDate()}$`))
  await expect(page.getByRole('status').filter({ hasText: g.page.saved })).toBeVisible()
  expect(savedGoals(email)).toEqual(['2000'])

  // el valor vigente se ve al reabrir la pantalla
  await page.goto('/objetivo')
  await expect(page.getByText(/^Vigente: 2\.000 kcal, desde el /)).toBeVisible()
})

test('escenario 3: valores inválidos se rechazan con su mensaje y no se guarda nada', async ({
  page,
}) => {
  const email = await registerUser(page)
  await page.goto('/objetivo')

  const cases: Array<[string, string]> = [
    ['999', g.validation.range],
    ['6001', g.validation.range],
    ['', g.validation.empty],
    ['abc', g.validation.notNumber],
    ['1800,5', g.validation.notInteger],
  ]
  for (const [text, message] of cases) {
    await field(page).fill(text)
    await saveButton(page).click()
    await expect(page.getByText(message)).toBeVisible()
  }
  expect(savedGoals(email)).toEqual([])
})

test('escenario 4: "2.000" y "2000,0" se guardan como 2.000', async ({ page }) => {
  const email = await registerUser(page)
  for (const text of ['2.000', '2000,0']) {
    await page.goto('/objetivo')
    await field(page).fill(text)
    await saveButton(page).click()
    await expect(page.getByRole('status').filter({ hasText: g.page.saved })).toBeVisible()
  }
  expect(savedGoals(email)).toEqual(['2000', '2000'])
})

test('escenario 5: un doble clic en "Guardar objetivo" deja una sola entrada', async ({ page }) => {
  const email = await registerUser(page)
  await page.goto('/objetivo')
  await field(page).fill('1900')
  await saveButton(page).dblclick()
  await expect(page.getByRole('status').filter({ hasText: g.page.saved })).toBeVisible()
  expect(savedGoals(email)).toEqual(['1900'])
})

test('escenario 6: sin red avisa que no se guardó, conserva el valor y reintentar funciona', async ({
  page,
  context,
}) => {
  const email = await registerUser(page)
  await page.goto('/objetivo')
  await expect(page.getByText(g.page.none)).toBeVisible()

  await field(page).fill('2100')
  await context.setOffline(true)
  await saveButton(page).click()
  await expect(page.getByRole('alert').filter({ hasText: g.page.notSaved })).toBeVisible()
  await expect(field(page)).toHaveValue('2100')
  expect(savedGoals(email)).toEqual([])

  await context.setOffline(false)
  await saveButton(page).click()
  await expect(page.getByRole('status').filter({ hasText: g.page.saved })).toBeVisible()
  expect(savedGoals(email)).toEqual(['2100'])
})

test('escenario 7: el borrador vuelve tras recargar y se borra al cerrar sesión', async ({
  page,
}) => {
  const email = await registerUser(page)
  await page.goto('/objetivo')
  await field(page).fill('1750')
  // el borrador se guarda al escribir; esperar a que quede en el almacenamiento local
  await expect
    .poll(() =>
      page.evaluate(
        () => Object.keys(localStorage).filter((k) => k.endsWith(':energy-goal')).length,
      ),
    )
    .toBe(1)

  await page.reload()
  await expect(field(page)).toHaveValue('1750')
  await expect(page.getByText(g.page.draftRestored)).toBeVisible()

  await page.getByRole('button', { name: es.auth.actions.logout }).click()
  await login(page, email, PASSWORD)
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
  await page.goto('/objetivo')
  await expect(field(page)).toHaveValue('')
})
