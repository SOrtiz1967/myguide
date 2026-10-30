// Spec 016: la semana del inicio, el panel del día, el menú nuevo y el recordatorio de peso.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const w = es.week
const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const iso = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    name,
  ).toEqual([])
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal en ${where}`).toBeLessThanOrEqual(0)
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('la semana muestra el estado de cada día y el panel cambia con el día elegido', async ({
  page,
}) => {
  const email = uniqueEmail('wk')
  await register(page, email)
  const user = userOf(email)
  dbQuery(`select tests.create_energy_goal(${user}, date '2000-01-01', 2000)`)
  const foodId = dbQuery(
    `select tests.create_food(${user}, 'Arroz propio e2e', null, 100, '100g', 1, 1, 1)`,
  )
  // La semana anterior completa (de lunes a domingo), sea cual sea el día de hoy: por debajo, en rango, por encima y sin
  // registro. Los desfases fijos (-7, -6…) caían en la semana en curso de viernes a domingo.
  const monday = -(((new Date().getDay() + 6) % 7) + 7)
  for (const [offset, kcal] of [
    [monday, 1000],
    [monday + 1, 2000],
    [monday + 2, 2600],
  ] as const) {
    dbQuery(
      `select tests.create_meal_entry(${user}, '${iso(offset)}', 'lunch', '${foodId}', ${kcal})`,
    )
  }
  dbQuery(`select tests.create_session(${user}, date '${iso(monday)}', 'completed', null, false)`)
  dbQuery(`select tests.create_session(${user}, date '${iso(monday + 3)}', 'planned', null, false)`)
  dbQuery(
    `insert into public.body_measurements (user_id, kind, value, measured_on, client_request_id) values (${user}, 'weight', 75.7, '${iso(monday)}', gen_random_uuid())`,
  )

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: w.title })).toBeVisible()
  await expect(page.getByRole('button', { name: /Calorías:/ })).toHaveCount(7)
  await expectNoViolations(page, 'semana')

  // la semana de hace siete días
  await page.getByRole('button', { name: w.prev }).click()
  await expect(
    page.getByRole('button', { name: /1\.000 de 2\.000 kcal, por debajo del rango/ }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /2\.000 de 2\.000 kcal, en rango/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /2\.600 de 2\.000 kcal, por encima del rango/ }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Entrenamiento: hecho/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Entrenamiento: sin registrar/ })).toBeVisible()
  await expectNoViolations(page, 'semana anterior')

  // el panel del día elegido dice que no es hoy y muestra sus datos
  await page.getByRole('button', { name: /por debajo del rango/ }).click()
  const panel = page.locator('section[aria-labelledby="panel-dia-titulo"]')
  await expect(panel.getByText(w.panel.notToday)).toBeVisible()
  await expect(panel.getByText(es.goal.registered(1000, false))).toBeVisible()
  await expect(panel.getByText('75,7 kg')).toBeVisible()
  await expect(panel.getByRole('link', { name: es.home.calories.register })).toHaveAttribute(
    'href',
    `/comidas/${iso(monday)}/agregar`,
  )

  // volver a esta semana
  await page.getByRole('button', { name: w.current }).click()
  await expect(page.getByText(w.panel.today, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: w.current })).toHaveCount(0)
})

test('menú: lateral en escritorio y barra inferior con «Más» en celular, sin desbordes', async ({
  page,
}) => {
  await register(page, uniqueEmail('wk'))

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: es.nav.label })
  await expect(nav.getByRole('link', { name: es.nav.home })).toHaveAttribute('aria-current', 'page')
  for (const name of [es.meals.navLink, es.foods.navLink, es.exercises.navLink, es.nav.profile]) {
    await expect(nav.getByRole('link', { name })).toBeVisible()
  }
  await expect(nav.getByRole('button', { name: es.nav.more })).toBeHidden()
  await expectNoHorizontalScroll(page, 'inicio (escritorio)')

  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: w.title })).toBeVisible()
  await expectNoHorizontalScroll(page, 'inicio (360 px)')
  await expect(nav.getByRole('link', { name: es.foods.navLink })).toBeHidden()
  await nav.getByRole('button', { name: es.nav.more }).click()
  await expect(nav.getByRole('link', { name: es.foods.navLink })).toBeVisible()
  await expect(nav.getByRole('button', { name: es.auth.actions.logout })).toBeVisible()
  await expectNoViolations(page, 'menú Más (360 px)')
  await nav.getByRole('link', { name: es.foods.navLink }).click()
  await expect(page).toHaveURL(/\/alimentos$/)
  await expect(nav.getByRole('link', { name: es.foods.navLink })).toBeHidden()
})
