// Specs 014 y 015: primer ingreso, objetivo físico y cálculo del objetivo calórico.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, registerRaw, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const o = es.onboarding
const userOf = (email: string) => `(select id from auth.users where email = '${email}')`

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

async function fillAbout(page: Page, birthDate = '1996-01-01') {
  await page.getByRole('radio', { name: o.about.sexOptions.male }).check()
  await page.getByLabel(o.about.birthDate).fill(birthDate)
  await page.getByLabel(o.about.height).fill('175')
  await page.getByLabel(o.about.weight).fill('75,5')
}

async function fillActivity(page: Page) {
  await page.getByRole('radio', { name: o.activity.jobOptions.mixed }).check()
  await page.getByLabel(o.activity.days).selectOption('3')
  await page.getByRole('radio', { name: o.activity.experienceOptions.intermediate }).check()
}

const next = (page: Page) => page.getByRole('button', { name: o.nav.next }).click()

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('una cuenta nueva completa el recorrido, queda con perfil, peso y objetivo, y puede recalcular', async ({
  page,
}) => {
  const email = uniqueEmail('ob')
  await registerRaw(page, email)

  // ninguna ruta privada se abre hasta completar el recorrido
  await page.goto('/medidas')
  await expect(page).toHaveURL(/\/bienvenida$/)
  await expect(page.getByText(o.stepOf(1, 4))).toBeVisible()
  await expectNoViolations(page, 'paso 1')

  await fillAbout(page)
  await next(page)
  await expect(page.getByText(o.stepOf(2, 4))).toBeVisible()
  await expectNoViolations(page, 'paso 2')

  // volver conserva lo escrito
  await page.getByRole('button', { name: o.nav.back }).click()
  await expect(page.getByLabel(o.about.weight)).toHaveValue('75,5')
  await next(page)

  await fillActivity(page)
  await next(page)
  await expect(page.getByText(o.stepOf(3, 4))).toBeVisible()
  await page.getByRole('radio', { name: o.goal.options.muscle_gain.label }).check()
  await next(page)

  await expect(page.getByText(o.stepOf(4, 4))).toBeVisible()
  await expect(page.getByText(es.plan.targetLabel)).toBeVisible()
  await expectNoViolations(page, 'paso 4')
  const shown = await page
    .getByText(es.plan.targetLabel)
    .locator('xpath=following-sibling::dd[1]')
    .innerText()
  const kcal = Number(shown.replace(/[^\d]/g, ''))
  expect(kcal).toBeGreaterThan(1000)

  await page.getByRole('button', { name: es.plan.actions.use }).click()
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()

  expect(
    dbQuery(
      `select goal_type, experience, job_activity, training_days, sex, height_cm, onboarding_completed_at is not null from public.profiles where user_id = ${userOf(email)}`,
    ),
  ).toBe('muscle_gain|intermediate|mixed|3|male|175.0|t')
  expect(
    dbQuery(
      `select value from public.body_measurements where kind = 'weight' and user_id = ${userOf(email)}`,
    ),
  ).toBe('75.5')
  expect(
    dbQuery(
      `select kcal from public.energy_goals where user_id = ${userOf(email)} order by created_at desc limit 1`,
    ),
  ).toBe(String(kcal))

  // /bienvenida ya no se muestra
  await page.goto('/bienvenida')
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()

  // recalcular desde /plan y elegir otro valor
  await page.goto('/plan')
  await expect(page.getByRole('heading', { level: 1, name: es.plan.title })).toBeVisible()
  await page.getByText(es.plan.method.summary).click()
  await expect(page.getByText(es.plan.basis.declared('3'))).toBeVisible()
  await expectNoViolations(page, 'plan')
  await page.getByRole('button', { name: es.plan.actions.other }).click()
  await page.getByLabel(es.plan.actions.otherLabel).fill('2400')
  await page.getByRole('button', { name: es.plan.actions.useOther }).click()
  await expect(page.getByText(es.plan.actions.saved)).toBeVisible()
  expect(
    dbQuery(
      `select kcal from public.energy_goals where user_id = ${userOf(email)} order by created_at desc limit 1`,
    ),
  ).toBe('2400')
})

test('valida cada paso, rechaza a menores de edad y no guarda nada hasta confirmar', async ({
  page,
}) => {
  const email = uniqueEmail('ob')
  await registerRaw(page, email)

  await next(page)
  await expect(page.getByText(o.errors.sex!)).toBeVisible()
  await expect(page.getByText(o.errors.birthDate!)).toBeVisible()
  await expect(page.getByText(o.errors.height!)).toBeVisible()
  await expect(page.getByText(es.measures.validation.required)).toBeVisible()

  const minor = new Intl.DateTimeFormat('en-CA').format(
    new Date(Date.now() - 10 * 365 * 86_400_000),
  )
  await fillAbout(page, minor)
  await next(page)
  await expect(page.getByText(o.errors.underage!)).toBeVisible()
  await expect(page.getByText(o.stepOf(1, 4))).toBeVisible()

  expect(
    dbQuery(
      `select onboarding_completed_at is null and birth_date is null from public.profiles where user_id = ${userOf(email)}`,
    ),
  ).toBe('t')
  expect(
    dbQuery(`select count(*) from public.body_measurements where user_id = ${userOf(email)}`),
  ).toBe('0')
})

test('se puede terminar sin objetivo calórico y el borrador se recupera al recargar', async ({
  page,
}) => {
  const email = uniqueEmail('ob')
  await registerRaw(page, email)
  await fillAbout(page)
  await page.reload()
  await expect(page.getByText(o.draftRestored)).toBeVisible()
  await expect(page.getByLabel(o.about.weight)).toHaveValue('75,5')

  await next(page)
  await fillActivity(page)
  await next(page)
  await page.getByRole('radio', { name: o.goal.options.fat_loss.label }).check()
  await next(page)
  await page.getByRole('button', { name: o.plan.later }).click()
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()

  expect(dbQuery(`select count(*) from public.energy_goals where user_id = ${userOf(email)}`)).toBe(
    '0',
  )
  expect(dbQuery(`select goal_type from public.profiles where user_id = ${userOf(email)}`)).toBe(
    'fat_loss',
  )
})
