// T032 (spec 003, escenarios 7, 8, 9, 19 y 27 del quickstart): la vista del día y moverse entre días.
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

function localDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return new Intl.DateTimeFormat('en-CA').format(date)
}

/** Crea ítems manuales de la cuenta actual directamente en la base (solo local). */
function seedEntries(
  email: string,
  rows: Array<{ date: string; meal: string; name: string; energy: number; protein?: number }>,
) {
  const uid = dbQuery(`select id from auth.users where email = '${email}'`)
  for (const row of rows) {
    const protein = row.protein === undefined ? 'null' : String(row.protein)
    dbQuery(
      `insert into public.meal_entries (user_id, log_date, meal, origin, food_name, energy_kcal, protein_g) values ('${uid}', '${row.date}', '${row.meal}', 'manual', '${row.name}', ${row.energy}, ${protein})`,
    )
  }
}

async function registerWithEmail(page: Page) {
  const email = uniqueEmail()
  await register(page, email)
  return email
}

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenarios 7 y 8: subtotales por comida, total del día y navegación entre días', async ({
  page,
}) => {
  const email = await registerWithEmail(page)
  seedEntries(email, [
    { date: localDate(), meal: 'breakfast', name: 'Tostadas dia e2e', energy: 200, protein: 6 },
    { date: localDate(), meal: 'lunch', name: 'Guiso dia e2e', energy: 450, protein: 22 },
    { date: localDate(), meal: 'snack', name: 'Mate dia e2e', energy: 0 },
    { date: localDate(-1), meal: 'dinner', name: 'Cena de ayer dia e2e', energy: 700 },
  ])

  await page.goto('/comidas')
  await expect(page).toHaveURL(new RegExp(`/comidas/${localDate()}$`))
  await expect(page.getByRole('heading', { level: 1 })).toContainText(es.meals.day.today)

  const total = page.getByRole('region', { name: es.meals.day.total })
  await expect(total).toContainText('650 kcal')
  await expect(total).toContainText('al menos 28 g · falta en 1 ítem') // proteínas 6 + 22; el mate no las informa
  await expect(total).toContainText('sin dato') // carbohidratos y grasas: ningún ítem los informa
  await expect(page.getByRole('group', { name: es.meals.day.subtotal }).first()).toContainText(
    '200 kcal',
  )
  await expect(page.getByText('Cena de ayer dia e2e')).toHaveCount(0)

  // el día anterior muestra solo lo suyo
  await page.getByRole('link', { name: /Día anterior/ }).click()
  await expect(page.getByText('Cena de ayer dia e2e')).toBeVisible()
  await expect(page.getByText('Guiso dia e2e')).toHaveCount(0)
  await expect(page.getByRole('region', { name: es.meals.day.total })).toContainText('700 kcal')

  // volver a hoy
  await page.getByRole('link', { name: es.meals.day.today, exact: true }).click()
  await expect(page.getByText('Guiso dia e2e')).toBeVisible()
})

test('escenario 9: un día sin registros muestra el estado vacío', async ({ page }) => {
  await registerWithEmail(page)
  await page.goto(`/comidas/${localDate(-3)}`)
  await expect(page.getByText(es.meals.day.empty)).toBeVisible()
  await expect(page.getByRole('link', { name: es.meals.day.addTo('Desayuno') })).toBeVisible()
})

test('escenario 19: cambiar la zona horaria del perfil no mueve de día a los ítems ya registrados', async ({
  page,
}) => {
  const email = await registerWithEmail(page)
  seedEntries(email, [
    { date: localDate(-2), meal: 'lunch', name: 'Fijo de anteayer e2e', energy: 300 },
  ])

  await page.goto(`/comidas/${localDate(-2)}`)
  await expect(page.getByText('Fijo de anteayer e2e')).toBeVisible()

  dbQuery(
    `update public.profiles set timezone = 'Pacific/Auckland' where user_id = (select id from auth.users where email = '${email}')`,
  )
  await page.reload()
  await expect(page.getByText('Fijo de anteayer e2e')).toBeVisible()
  dbQuery(
    `update public.profiles set timezone = 'Pacific/Honolulu' where user_id = (select id from auth.users where email = '${email}')`,
  )
  await page.reload()
  await expect(page.getByText('Fijo de anteayer e2e')).toBeVisible()
})

test('escenario 27: un día con 60 ítems carga completo, con totales correctos, en menos de 2 s', async ({
  page,
}) => {
  const email = await registerWithEmail(page)
  const uid = dbQuery(`select id from auth.users where email = '${email}'`)
  dbQuery(
    `insert into public.meal_entries (user_id, log_date, meal, origin, food_name, energy_kcal) select '${uid}', '${localDate()}', (array['breakfast','lunch','snack','dinner','extra'])[1 + n % 5], 'manual', 'Ítem número ' || n, 10 from generate_series(1, 60) n`,
  )

  // Se mide la navegación dentro de la aplicación ya cargada (lo que tarda en verse el día), no el
  // arranque en frío del servidor de desarrollo.
  await page.goto('/')
  await expect(page.getByRole('link', { name: es.meals.navLink })).toBeVisible()
  const started = Date.now()
  await page.getByRole('link', { name: es.meals.navLink }).click()
  await expect(page.getByRole('region', { name: es.meals.day.total })).toContainText('600 kcal')
  await expect(page.getByRole('link', { name: /Ítem número/ })).toHaveCount(60)
  expect(Date.now() - started, 'tiempo hasta ver el día completo').toBeLessThan(2000)
})
