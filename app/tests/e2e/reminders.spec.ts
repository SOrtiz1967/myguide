// Spec 021: recordatorios de punta a punta (configurar en el perfil, avisos en el inicio, más tarde, desactivar, aislamiento y
// accesibilidad a 375 y 1280 px).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const c = es.reminders

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const row = (email: string, kind: string, column: string) =>
  dbQuery(
    `select ${column} from public.reminders where user_id = ${userOf(email)} and kind = '${kind}'`,
  )

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

const card = (page: Page, kind: 'weight' | 'photos' | 'supplements') =>
  page.getByRole('region', { name: c.card.names[kind] }).filter({ hasText: /opcional/ })

/** Activa los tres recordatorios con frecuencias que corresponden hoy, sea cual sea el día. */
async function configureAll(page: Page) {
  await page.goto('/perfil')
  const section = page.getByRole('region', { name: c.title })

  await section.getByLabel(c.enable.weight).check()
  await section.getByRole('button', { name: c.save('Peso') }).click()
  await expect(section.getByText(c.saved('Peso'))).toBeVisible()

  await section.getByLabel(c.enable.photos).check()
  await section
    .getByRole('form', { name: c.names.photos })
    .getByLabel(c.frequencyLabel)
    .selectOption('every_n_days')
  await section.getByRole('form', { name: c.names.photos }).getByLabel(c.everyN).fill('14')
  await section.getByRole('button', { name: c.save('Fotos de progreso') }).click()
  await expect(section.getByText(c.saved('Fotos de progreso'))).toBeVisible()

  await section.getByLabel(c.enable.supplements).check()
  const supp = section.getByRole('form', { name: c.names.supplements })
  await supp.getByLabel(c.frequencyLabel).selectOption('weekdays')
  for (const day of es.training.weeklyPlan.weekdays) await supp.getByLabel(day).check()
  await section.getByRole('button', { name: c.save('Suplementos') }).click()
  await expect(section.getByText(c.saved('Suplementos'))).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('configurar, ver los avisos, posponer, desactivar y que lo registrado los apague', async ({
  page,
}) => {
  const email = uniqueEmail('rec')
  await register(page, email)
  dbQuery(
    `insert into public.supplements (user_id, name, client_request_id) values (${userOf(email)}, 'Creatina', gen_random_uuid())`,
  )

  await page.goto('/')
  await expect(page.getByRole('region', { name: c.card.region })).toHaveCount(0)

  await configureAll(page)
  expect(row(email, 'weight', 'frequency')).toBe('daily')
  expect(row(email, 'photos', 'every_n')).toBe('14')
  expect(row(email, 'supplements', 'array_length(weekdays, 1)')).toBe('7')

  // Se conserva al recargar.
  await page.reload()
  await expect(page.getByLabel(c.enable.photos)).toBeChecked()
  await expect(page.getByRole('form', { name: c.names.photos }).getByLabel(c.everyN)).toHaveValue(
    '14',
  )

  // En el inicio hay una tarjeta por cada uno, con texto opcional y sin culpa.
  await page.goto('/')
  await expect(card(page, 'weight')).toBeVisible()
  await expect(card(page, 'photos')).toBeVisible()
  await expect(card(page, 'supplements')).toBeVisible()
  await expect(page.getByText(/olvidaste|racha|llevas \d+ días/i)).toHaveCount(0)

  // «Más tarde»: desaparece, queda guardado en la cuenta y no vuelve al recargar.
  await card(page, 'photos').getByRole('button', { name: c.card.later }).click()
  await expect(card(page, 'photos')).toHaveCount(0)
  expect(row(email, 'photos', 'snoozed_until is not null')).toBe('t')
  await page.reload()
  await expect(card(page, 'weight')).toBeVisible()
  await expect(card(page, 'photos')).toHaveCount(0)

  // «Desactivar»: queda apagado con su frecuencia, y se ve apagado en el perfil.
  await card(page, 'weight').getByRole('button', { name: c.card.disable }).click()
  await expect(card(page, 'weight')).toHaveCount(0)
  expect(row(email, 'weight', 'enabled')).toBe('f')
  expect(row(email, 'weight', 'frequency')).toBe('daily')
  await page.goto('/perfil')
  await expect(page.getByLabel(c.enable.weight)).not.toBeChecked()

  // Marcar el suplemento de hoy apaga su aviso.
  await page.goto('/')
  await expect(card(page, 'supplements')).toBeVisible()
  await page
    .getByRole('region', { name: es.supplements.day.title })
    .getByRole('checkbox', { name: /Creatina/ })
    .click()
  await expect(card(page, 'supplements')).toHaveCount(0)
})

test('rechaza valores inválidos y la otra cuenta no ve los recordatorios', async ({
  page,
  browser,
}) => {
  const emailA = uniqueEmail('rec')
  await register(page, emailA)
  await page.goto('/perfil')
  const section = page.getByRole('region', { name: c.title })
  await section.getByLabel(c.enable.photos).check()
  const photos = section.getByRole('form', { name: c.names.photos })
  await photos.getByLabel(c.frequencyLabel).selectOption('every_n_days')
  await photos.getByLabel(c.everyN).fill('1')
  await photos.getByRole('button', { name: c.save('Fotos de progreso') }).click()
  await expect(photos.getByText(new RegExp(c.errors.every_n_invalid))).toBeVisible()
  expect(dbQuery(`select count(*) from public.reminders where user_id = ${userOf(emailA)}`)).toBe(
    '0',
  )

  // Los suplementos no ofrecen «cada tantos días».
  await section.getByLabel(c.enable.supplements).check()
  const options = section
    .getByRole('form', { name: c.names.supplements })
    .getByLabel(c.frequencyLabel)
    .locator('option')
  await expect(options).toHaveText([c.frequencies.daily, c.frequencies.weekdays])

  await configureAll(page)
  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('otra'))
  await other.goto('/perfil')
  await expect(other.getByLabel(c.enable.weight)).not.toBeChecked()
  await other.goto('/')
  await expect(other.getByRole('region', { name: c.card.region })).toHaveCount(0)
  expect(dbQuery(`select count(*) from public.reminders where user_id = ${userOf(emailA)}`)).toBe(
    '3',
  )
  await other.close()
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}: perfil con recordatorios e inicio con avisos`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    const email = uniqueEmail('rea')
    await register(page, email)
    dbQuery(
      `insert into public.supplements (user_id, name, client_request_id) values (${userOf(email)}, 'Creatina', gen_random_uuid())`,
    )
    await configureAll(page)
    await expectNoViolations(page, `perfil (${label})`)
    await expectNoHorizontalScroll(page, `perfil (${label})`)

    await page.goto('/')
    await expect(card(page, 'weight')).toBeVisible()
    await expect(card(page, 'supplements')).toBeVisible()
    await expectNoViolations(page, `inicio con avisos (${label})`)
    await expectNoHorizontalScroll(page, `inicio con avisos (${label})`)
  })
}
