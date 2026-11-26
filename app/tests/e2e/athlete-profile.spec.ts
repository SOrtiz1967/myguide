// Spec 025: perfil de atleta de punta a punta (objetivos con prioridad, disponibilidad, preferencias, historial,
// aislamiento y accesibilidad a 375 y 1280 px).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const c = es.athlete

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const count = (table: string, email: string) =>
  dbQuery(`select count(*) from public.${table} where user_id = ${userOf(email)}`)

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
  test.setTimeout(150_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('completar objetivos, disponibilidad y preferencias, y recuperarlos al recargar', async ({
  page,
}) => {
  const email = uniqueEmail('athlete')
  await register(page, email)

  await page.goto('/perfil')
  await page.getByRole('link', { name: c.link }).click()
  await expect(page.getByRole('heading', { level: 1, name: c.title })).toBeVisible()

  // Una cuenta nueva no trae nada completado por suposición.
  expect(count('athlete_goals', email)).toBe('0')
  expect(count('athlete_availability', email)).toBe('0')

  // Objetivos: dos, con prioridad; el principal también pasa al perfil.
  const goals = page.locator('form', { has: page.getByRole('heading', { name: c.goals.title }) })
  await goals.getByRole('button', { name: c.goals.add }).click()
  await goals.getByRole('combobox').first().selectOption('hypertrophy')
  await goals.getByRole('button', { name: c.goals.add }).click()
  await goals.getByRole('combobox').nth(1).selectOption('strength')
  await goals.getByRole('checkbox').check()
  await goals.getByRole('button', { name: c.goals.save }).click()
  await expect(page.getByText(c.goals.saved)).toBeVisible()
  expect(count('athlete_goals', email)).toBe('1')
  expect(dbQuery(`select goal_type from public.profiles where user_id = ${userOf(email)}`)).toBe(
    'muscle_gain',
  )

  // Disponibilidad.
  const availability = page.locator('form', {
    has: page.getByRole('heading', { name: c.availability.title }),
  })
  await availability.getByLabel(c.availability.days).selectOption('4')
  await availability.getByLabel(c.availability.minutes).fill('60')
  await availability.getByLabel(c.availability.equipmentOptions.barbell).check()
  await availability.getByRole('button', { name: c.availability.save }).click()
  await expect(page.getByText(c.availability.saved)).toBeVisible()
  expect(count('athlete_availability', email)).toBe('1')

  // Preferencias: sin completar el resto, todo queda sin valor.
  const prefs = page.locator('form', {
    has: page.getByRole('heading', { name: c.preferences.title }),
  })
  await prefs.getByLabel(c.preferences.muscleNames.chest).check()
  await prefs.getByLabel(c.preferences.effortScales.rpe).check()
  await prefs.getByRole('button', { name: c.preferences.save }).click()
  await expect(page.getByText(c.preferences.saved)).toBeVisible()
  expect(
    dbQuery(
      `select coalesce(usual_sleep_minutes::text, 'null') from public.athlete_preferences where user_id = ${userOf(email)}`,
    ),
  ).toBe('null')

  // Todo se conserva al recargar.
  await page.reload()
  await expect(page.getByLabel(c.availability.days)).toHaveValue('4')
  await expect(page.getByLabel(c.preferences.muscleNames.chest)).toBeChecked()
  await expect(page.getByLabel(c.preferences.effortScales.rpe)).toBeChecked()

  // Un cambio de disponibilidad agrega una fila y conserva la anterior (Principio II).
  await page.getByLabel(c.availability.days).selectOption('5')
  await page.getByRole('button', { name: c.availability.save }).click()
  await expect(page.getByText(c.availability.saved)).toBeVisible()
  expect(count('athlete_availability', email)).toBe('2')
})

test('un objetivo personalizado sin texto no se guarda y B no ve lo de A', async ({ page }) => {
  const a = uniqueEmail('athlete-a')
  await register(page, a)
  await page.goto('/perfil/atleta')

  const goals = page.locator('form', { has: page.getByRole('heading', { name: c.goals.title }) })
  await goals.getByRole('button', { name: c.goals.add }).click()
  await goals.getByRole('combobox').first().selectOption('custom')
  await goals.getByRole('button', { name: c.goals.save }).click()
  await expect(page.getByText(c.errors.label)).toBeVisible()
  expect(count('athlete_goals', a)).toBe('0')

  await goals.getByLabel(c.goals.customLabel).fill('Correr 10 km')
  await goals.getByRole('button', { name: c.goals.save }).click()
  await expect(page.getByText(c.goals.saved)).toBeVisible()
  expect(count('athlete_goals', a)).toBe('1')

  // Otra cuenta no ve nada de A.
  await page.context().clearCookies()
  await page.evaluate(() => window.localStorage.clear())
  const b = uniqueEmail('athlete-b')
  await register(page, b)
  await page.goto('/perfil/atleta')
  await expect(page.getByLabel(c.goals.customLabel)).toHaveCount(0)
  expect(count('athlete_goals', b)).toBe('0')
})

for (const viewport of [
  { width: 375, height: 800 },
  { width: 1280, height: 900 },
]) {
  test(`accesibilidad y sin desplazamiento horizontal a ${viewport.width} px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await register(page, uniqueEmail('athlete-a11y'))
    await page.goto('/perfil/atleta')
    await expect(page.getByRole('heading', { level: 1, name: c.title })).toBeVisible()
    await expectNoViolations(page, `perfil de atleta ${viewport.width}`)
    await expectNoHorizontalScroll(page, `perfil de atleta ${viewport.width}`)
  })
}
