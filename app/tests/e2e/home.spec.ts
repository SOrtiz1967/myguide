// T009 (spec 013): el inicio «Hoy» con una cuenta vacía, con datos, con un bloque que falla, accesible y sin desbordes.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const h = es.home
const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const today = () => new Intl.DateTimeFormat('en-CA').format(new Date())

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`),
    `Violaciones de accesibilidad en ${name}`,
  ).toEqual([])
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal en ${where}`).toBeLessThanOrEqual(0)
}

test.beforeAll(() => {
  clearSeededExercises()
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('cuenta vacía: bloques vacíos, invitaciones y los cuatro accesos', async ({ page }) => {
  await register(page, uniqueEmail('hm'))
  await page.goto('/')
  await expect(page.getByText(h.calories.empty)).toBeVisible()
  await expect(page.getByText(h.training.empty)).toBeVisible()
  await expect(page.getByText(h.last.noMeal)).toBeVisible()
  await expect(page.getByText(h.last.noSession)).toBeVisible()
  for (const name of [h.quick.meal, h.quick.train, h.quick.calendar, h.quick.profile]) {
    await expect(page.getByRole('link', { name })).toBeVisible()
  }
  await expectNoViolations(page, 'inicio vacío')

  await page.getByRole('link', { name: h.quick.profile }).click()
  await expect(page).toHaveURL(/\/perfil$/)
  await page.goto('/')
  await page.getByRole('link', { name: h.quick.calendar }).click()
  await expect(page).toHaveURL(/\/entrenamiento#calendario$/)
  await expect(page.getByRole('heading', { name: es.training.calendar.title })).toBeVisible()
})

test('con datos: calorías, entrenamiento y últimos registros; un bloque que falla no rompe los demás', async ({
  page,
}) => {
  const email = uniqueEmail('hm')
  await register(page, email)
  const user = userOf(email)
  dbQuery(`select tests.create_energy_goal(${user}, date '2000-01-01', 2000)`)
  const foodId = dbQuery(
    `select tests.create_food(${user}, 'Arroz propio e2e', null, 100, '100g', 1, 1, 1)`,
  )
  dbQuery(`select tests.create_meal_entry(${user}, '${today()}', 'lunch', '${foodId}', 500)`)
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  const exerciseId = dbQuery(
    `select id from public.exercises where user_id = ${user} and name = 'Press e2e'`,
  )
  const routineId = dbQuery(
    `select tests.create_routine(${user}, 'Torso e2e', array['${exerciseId}'::uuid], 3)`,
  )
  dbQuery(
    `select tests.create_session(${user}, date '${today()}', 'planned', '${routineId}', true)`,
  )
  dbQuery(
    `select tests.create_session(${user}, date '2026-01-10', 'completed', '${routineId}', true)`,
  )

  await page.goto('/')
  await expect(page.getByText(es.goal.goalLine(2000))).toBeVisible()
  await expect(page.getByText(es.goal.registered(500, false))).toBeVisible()
  await expect(
    page.getByRole('button', { name: es.training.planning.start, exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Última sesión/ })).toContainText('10/01/2026')
  await expect(page.getByRole('link', { name: /Última comida/ })).toBeVisible()
  await expectNoViolations(page, 'inicio con datos')

  // un bloque que falla: las comidas; el entrenamiento y los accesos siguen
  await page.route('**/rest/v1/meal_entries*', (route) =>
    route.fulfill({ status: 500, body: '{}' }),
  )
  await page.reload()
  await expect(page.getByText(h.loadError).first()).toBeVisible()
  await expect(
    page.getByRole('button', { name: es.training.planning.start, exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: h.quick.profile })).toBeVisible()
})

for (const viewport of [
  { name: 'teléfono', width: 375, height: 667 },
  { name: 'escritorio', width: 1280, height: 800 },
]) {
  test(`sin desplazamiento horizontal: ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await register(page, uniqueEmail('hm'))
    await page.goto('/')
    await expect(page.getByText(h.calories.empty)).toBeVisible()
    await expectNoHorizontalScroll(page, `inicio (${viewport.name})`)
  })
}
