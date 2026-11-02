// Spec 010: Tendencias de punta a punta (con accesibilidad a 375 y 1280 px).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.trends

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`

/** Una comida de 2.000 kcal hace 14 días: queda dentro de las 12 semanas por omisión. */
function seedMeal(email: string) {
  dbQuery(
    `select tests.create_manual_entry(${userOf(email)}, current_date - 14, 'lunch', 'Almuerzo e2e tendencias', 2000)`,
  )
}

/** Una sesión realizada de pecho hace 3 días, con 2 series, y una noche de sueño de 7 h 30 min ese mismo día. */
function seedTrainingAndSleep(email: string) {
  const user = userOf(email)
  const exercise = dbQuery(
    `select tests.create_exercise(${user}, 'Press e2e tendencias', 'reps_weight', array['chest'])`,
  )
  const session = dbQuery(`select tests.create_session(${user}, current_date - 3, 'completed')`)
  const item = dbQuery(`select tests.add_session_exercise('${session}', '${exercise}')`)
  dbQuery(`select tests.add_session_set('${item}', 8, 60)`)
  dbQuery(`select tests.add_session_set('${item}', 8, 62.5)`)
  dbQuery(
    `insert into public.daily_activity (user_id, kind, value, activity_date, client_request_id) values (${user}, 'sleep', 450, current_date - 3, gen_random_uuid())`,
  )
}

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    ),
    `Violaciones de accesibilidad en ${name}`,
  ).toEqual([])
}

async function expectNoHorizontalScroll(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `Desplazamiento horizontal en ${name}`).toBeLessThanOrEqual(0)
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('del inicio a Tendencias: alimentación, mantenimiento sin datos suficientes y entrenamiento con sueño', async ({
  page,
}) => {
  const email = uniqueEmail('tend')
  await register(page, email)
  seedMeal(email)
  seedTrainingAndSleep(email)

  await page.goto('/')
  await page.getByRole('link', { name: t.homeLink }).click()
  await expect(page).toHaveURL(/\/tendencias/)
  await expect(page.getByRole('heading', { name: t.nutrition.title })).toBeVisible()

  // Alimentación: la semana de la comida tiene su promedio y su día con registro.
  const list = page.getByRole('list', { name: t.nutrition.listLabel })
  await expect(list.getByText('2.000 kcal por día')).toBeVisible()
  await expect(list.getByText(t.nutrition.recordedDays(1))).toBeVisible()
  await expect(list.getByText(t.nutrition.noRecord).first()).toBeVisible()

  // Mantenimiento: con una sola comida no hay cifra y se dice qué falta.
  await expect(page.getByText(t.maintenance.missingTitle)).toBeVisible()
  await expect(page.getByText(/^Entre /)).toHaveCount(0)
  await page.getByText(t.maintenance.methodSummary).click()
  await expect(page.getByText(/7\.700 kcal por kilo/)).toBeVisible()

  // Entrenamiento y sueño: el grupo, las series y el sueño de la misma semana.
  await page.getByRole('button', { name: 'Pecho' }).click()
  await page.getByText(t.training.table.summary).click()
  const row = page.getByRole('table').getByRole('row').nth(1)
  await expect(row.getByRole('cell').first()).toHaveText('2')
  await expect(row.getByText('7 h 30 min')).toBeVisible()

  await expect(page.getByText(/récord|racha|adherencia|déficit|superávit|correlaci/i)).toHaveCount(
    0,
  )
})

test('sin datos cada sección muestra su estado vacío', async ({ page }) => {
  const email = uniqueEmail('tend')
  await register(page, email)
  await page.goto('/tendencias')
  await expect(page.getByText(t.nutrition.empty)).toBeVisible()
  await expect(page.getByText(t.training.emptyTraining)).toBeVisible()
  await expect(page.getByText(new RegExp(t.training.emptySleep))).toBeVisible()
})

test('el período cambia la cantidad de semanas del gráfico', async ({ page }) => {
  const email = uniqueEmail('tend')
  await register(page, email)
  seedTrainingAndSleep(email)
  await page.goto('/tendencias')
  await expect(
    page.getByRole('group', { name: /Series y sueño por semana: 12 semanas/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: t.periods['4w'] }).click()
  await expect(
    page.getByRole('group', { name: /Series y sueño por semana: 4 semanas/ }),
  ).toBeVisible()
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const email = uniqueEmail('tenda')
    await register(page, email)
    seedMeal(email)
    seedTrainingAndSleep(email)

    await page.goto('/tendencias')
    await expect(page.getByRole('group', { name: /Series y sueño por semana/ })).toBeVisible()
    await expect(page.getByRole('list', { name: t.nutrition.listLabel })).toBeVisible()
    await expectNoViolations(page, `tendencias (${label})`)
    await expectNoHorizontalScroll(page, `tendencias (${label})`)

    await page.getByText(t.maintenance.methodSummary).click()
    await page.getByText(t.training.table.summary).click()
    await expectNoViolations(page, `tendencias con método y tabla (${label})`)
    await expectNoHorizontalScroll(page, `tendencias con método y tabla (${label})`)
  })
}
