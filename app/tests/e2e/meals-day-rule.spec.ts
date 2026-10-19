// T048 (spec 003, escenarios 17, 18 y 19 del quickstart): la regla del día.
//
// La propuesta del día que se cierra la decide el servidor con su propio reloj, así que no se simula el
// tiempo: se le da a la cuenta de la prueba una zona horaria en la que ahora son las 01:xx. Sin límite de
// hora, la regla se comporta igual a cualquier hora del día nuevo (FR-025).
import { expect, test, type Page } from '@playwright/test'
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

const ZONE = zoneWhereItIsOneAm()
const TODAY = dayIn(ZONE)
const YESTERDAY = dayIn(ZONE, -1)

let email = ''

/** Registra a la persona, le pone la zona y deja una cena registrada ayer. */
async function arrive(page: Page) {
  email = uniqueEmail()
  await register(page, email)
  dbQuery(
    `update public.profiles set timezone = '${ZONE}' where user_id = (select id from auth.users where email = '${email}')`,
  )
  dbQuery(
    `select tests.create_meal_entry((select id from auth.users where email = '${email}'), '${YESTERDAY}', 'dinner', (select id from public.foods where source_item_id = 'E2E-rule1'), 100)`,
  )
}

const entriesOn = (day: string) =>
  dbQuery(
    `select count(*) from public.meal_entries where user_id = (select id from auth.users where email = '${email}') and log_date = '${day}'`,
  )

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([{ id: 'rule1', name: 'Cena regla e2e', energy: 200 }])
})

test.afterAll(() => {
  clearSeededEntries()
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await arrive(page)
})

test('escenario 17: a la 01:00, sin nada en el día nuevo, se propone el día que se cierra', async ({
  page,
}) => {
  await page.goto('/comidas')
  await expect(page).toHaveURL(new RegExp(`/comidas/${YESTERDAY}$`))
  const notice = page.getByRole('region', { name: /^Registrando en el / })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('button', { name: es.meals.day.startToday })).toBeVisible()

  // Agregar desde ahí registra en ese día, con la fecha de destino a la vista.
  await page
    .getByRole('region', { name: es.meals.names.dinner })
    .getByRole('link', { name: es.meals.day.addTo(es.meals.names.dinner) })
    .click()
  await expect(page.getByText(/^Se registrará en el /)).toBeVisible()
  await page.getByRole('searchbox', { name: es.meals.add.search }).fill('cena regla e2e')
  await page.getByRole('button', { name: /Cena regla e2e/ }).click()
  await page.getByRole('button', { name: es.meals.add.confirm }).click()
  await expect(page).toHaveURL(new RegExp(`/comidas/${YESTERDAY}$`))
  expect(entriesOn(YESTERDAY)).toBe('2')
  expect(entriesOn(TODAY)).toBe('0')
})

test('escenario 18: "Empezar el día de hoy" propone el día nuevo', async ({ page }) => {
  await page.goto(`/comidas/${YESTERDAY}`)
  await page.getByRole('button', { name: es.meals.day.startToday }).click()
  await expect(page).toHaveURL(new RegExp(`/comidas/${TODAY}$`))
  await expect(page.getByRole('region', { name: /^Registrando en el / })).toHaveCount(0)

  // Aunque hoy siga vacío, ya no se propone el día anterior.
  await page.goto('/comidas')
  await expect(page).toHaveURL(new RegExp(`/comidas/${TODAY}$`))
})

test('escenario 19: cambiar la zona horaria del perfil no mueve lo ya registrado', async ({
  page,
}) => {
  const day = () =>
    dbQuery(
      `select log_date from public.meal_entries where food_name = 'Cena regla e2e' and user_id = (select id from auth.users where email = '${email}')`,
    )
  expect(day()).toBe(YESTERDAY)

  dbQuery(
    `update public.profiles set timezone = 'Pacific/Kiritimati' where user_id = (select id from auth.users where email = '${email}')`,
  )
  expect(day()).toBe(YESTERDAY)

  await page.goto(`/comidas/${YESTERDAY}`)
  await expect(page.getByText('Cena regla e2e')).toBeVisible()
})
