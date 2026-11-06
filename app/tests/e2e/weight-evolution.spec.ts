// Spec 020: evolución del peso de punta a punta (gráfico, períodos, ayunas y accesibilidad a 375 y 1280 px).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const m = es.measures
const c = m.evolution

/** Doce pesos cada dos días hacia atrás desde ayer; los de índice par, en ayunas (6). */
function seedWeights(email: string) {
  // La consulta va en una sola línea: el intérprete de comandos de Windows corta en cada salto.
  dbQuery(
    `insert into public.body_measurements (user_id, kind, value, measured_on, client_request_id, fasting) select u.id, 'weight', 72 + (n % 5) * 0.2, current_date - n * 2, gen_random_uuid(), n % 2 = 0 from auth.users u, generate_series(1, 12) n where u.email = '${email}'`,
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
  test.setTimeout(150_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('gráfico del período, cifras, teclado, ayunas y recarga', async ({ page }) => {
  const email = uniqueEmail('wev')
  await register(page, email)
  await page.goto('/medidas')

  // Sin pesos: estado vacío y nada de promedio ni cifras.
  await expect(page.getByText(c.emptyTitle)).toBeVisible()
  await expect(page.getByRole('region', { name: c.stats.title })).toHaveCount(0)

  seedWeights(email)
  await page.reload()
  const chart = page.getByRole('group', { name: /Gráfico del peso en kilogramos, 12 registros/ })
  await expect(chart).toBeVisible()
  const figures = page.getByRole('region', { name: c.stats.title })
  await expect(figures.getByText(c.stats.count).locator('xpath=following-sibling::dd')).toHaveText(
    '12',
  )

  // Un período más corto deja menos registros (los de los últimos 10 días: 4, 6, 8, 10 días atrás → 4 o 5).
  await page.getByRole('button', { name: c.periods['30d'] }).click()
  await expect(page.getByRole('group', { name: /12 registros/ })).toBeVisible()
  await page.getByRole('button', { name: c.periods['90d'] }).click()

  // Teclado: el foco lee el último registro y las flechas recorren.
  await chart.focus()
  const reading = page.getByRole('status').filter({ hasText: /kg\./ })
  await expect(reading).toBeVisible()
  const last = await reading.textContent()
  await page.keyboard.press('ArrowLeft')
  await expect(reading).not.toHaveText(last ?? '')

  // Solo en ayunas: usa únicamente los 6 marcados, dice cuántos quedaron fuera y se recuerda al recargar.
  await page.getByRole('button', { name: c.filter.fasting }).click()
  await expect(
    page.getByRole('group', { name: /Gráfico del peso en kilogramos, 6 registros/ }),
  ).toBeVisible()
  await expect(page.getByText(c.excluded(6))).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: c.filter.fasting })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('group', { name: /6 registros/ })).toBeVisible()
  await page.getByRole('button', { name: c.filter.all }).click()

  // Registrar un peso en ayunas: queda marcado en el historial y en la base.
  await page.getByLabel(/^Valor \(/).fill('71,5')
  await page.getByLabel(m.fasting.label).check()
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(m.form.saved)).toBeVisible()
  await expect(page.getByText(m.fasting.tag).first()).toBeVisible()
  expect(
    dbQuery(
      `select count(*) from public.body_measurements b join auth.users u on u.id = b.user_id where u.email = '${email}' and b.kind = 'weight' and b.fasting`,
    ),
  ).toBe('7')
  await expect(page.getByRole('group', { name: /13 registros/ })).toBeVisible()

  // Lo escrito no es un juicio ni una conclusión.
  await expect(
    page.getByRole('main').getByText(/bajaste|subiste|perdiste|ganaste|tendencia/i),
  ).toHaveCount(0)
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}: vacío, con datos y solo en ayunas`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const email = uniqueEmail('wea')
    await register(page, email)
    await page.goto('/medidas')
    await expect(page.getByText(c.emptyTitle)).toBeVisible()
    await expectNoViolations(page, `vacío (${label})`)
    await expectNoHorizontalScroll(page, `vacío (${label})`)

    seedWeights(email)
    await page.reload()
    await expect(page.getByRole('group', { name: /12 registros/ })).toBeVisible()
    await expectNoViolations(page, `con datos (${label})`)
    await expectNoHorizontalScroll(page, `con datos (${label})`)

    await page.getByRole('button', { name: c.filter.fasting }).click()
    await expect(page.getByRole('group', { name: /6 registros/ })).toBeVisible()
    await page.getByText(c.table.summary).click()
    await expectNoViolations(page, `en ayunas con tabla (${label})`)
    await expectNoHorizontalScroll(page, `en ayunas con tabla (${label})`)
  })
}
