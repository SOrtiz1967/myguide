// T054: perfil de punta a punta (escenarios 9 a 13 del quickstart).
import { expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

async function fillProfile(page: import('@playwright/test').Page) {
  await page.goto('/perfil')
  await page.getByLabel(es.profile.labels.birthDate).fill('1990-05-17')
  await page.getByLabel(es.profile.labels.height).fill('171,5')
  await page
    .getByLabel(es.profile.labels.timezone, { exact: true })
    .selectOption('America/Buenos_Aires')
}

test('escenarios 9 y 10: completar el perfil, recargar y ver los valores con su unidad; sexo sin informar', async ({
  page,
}) => {
  await register(page, uniqueEmail())
  // Perfil incompleto: el inicio lo guía a completarlo (estado vacío).
  await expect(page.getByRole('heading', { name: es.profile.emptyTitle })).toBeVisible()
  await page.getByRole('button', { name: es.profile.emptyAction }).click()
  await expect(page).toHaveURL(/\/perfil$/)

  await fillProfile(page)
  await page
    .getByLabel(es.profile.labels.sex)
    .selectOption({ label: es.profile.sexOptions.unspecified })
  await page.getByRole('button', { name: es.profile.save }).click()
  await expect(page.getByText(es.profile.saved)).toBeVisible()

  await page.reload()
  const summary = page.getByRole('region', { name: es.profile.summaryTitle })
  await expect(summary.getByText('171,5 cm')).toBeVisible()
  await expect(summary.getByText('17/05/1990')).toBeVisible()
  // El sexo quedó como no informado: nunca se supone un valor.
  const sexRow = summary.locator('div', { hasText: es.profile.labels.sex }).first()
  await expect(sexRow).toContainText(es.profile.notInformed)

  // Con el perfil completo desaparece el estado vacío del inicio.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: es.profile.emptyTitle })).toHaveCount(0)
})

test('escenario 11 (FR-016): la zona horaria del dispositivo se propone pero no cambia sola', async ({
  browser,
}) => {
  const context = await browser.newContext({ timezoneId: 'Europe/Madrid' })
  const page = await context.newPage()
  await stubTurnstile(page)
  await register(page, uniqueEmail())

  await fillProfile(page)
  await page.getByRole('button', { name: es.profile.save }).click()
  await expect(page.getByText(es.profile.saved)).toBeVisible()

  // Dispositivo en Madrid, perfil en Buenos Aires: se ofrece el cambio, sin aplicarlo.
  const notice = page.getByRole('region', { name: es.profile.timezoneNoticeTitle })
  await expect(notice).toContainText('Europe/Madrid')
  await page.reload()
  await expect(
    page.getByRole('region', { name: es.profile.summaryTitle }).getByText('America/Buenos_Aires'),
  ).toBeVisible()

  await page.getByRole('button', { name: es.profile.useDeviceTimezone('Europe/Madrid') }).click()
  await expect(
    page.getByRole('region', { name: es.profile.summaryTitle }).getByText('Europe/Madrid'),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: es.profile.timezoneNoticeTitle })).toHaveCount(0)
  await context.close()
})

test('escenario 12 (FR-021): lo escrito sobrevive a una recarga como borrador', async ({
  page,
}) => {
  await register(page, uniqueEmail())
  await page.goto('/perfil')
  await page.getByLabel(es.profile.labels.height).fill('188')
  await page.reload()

  await expect(page.getByText(es.profile.draftRestored)).toBeVisible()
  await expect(page.getByLabel(es.profile.labels.height)).toHaveValue('188')
})

test('escenario 13 (FR-022): al cerrar sesión no queda ningún borrador en el navegador', async ({
  page,
}) => {
  await register(page, uniqueEmail())
  await page.goto('/perfil')
  await page.getByLabel(es.profile.labels.height).fill('188')
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('draft:'))),
  ).not.toEqual([])

  await page.getByRole('button', { name: es.auth.actions.logout }).click()
  await expect(page).toHaveURL(/\/ingresar$/)
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('draft:'))),
  ).toEqual([])
})

test('FR-014: una altura fuera de rango se rechaza con un mensaje claro y no se guarda', async ({
  page,
}) => {
  await register(page, uniqueEmail())
  await page.goto('/perfil')
  await page.getByLabel(es.profile.labels.height).fill('30')
  await page.getByRole('button', { name: es.profile.save }).click()
  await expect(page.getByText(es.profile.errors.height)).toBeVisible()
  await expect(page.getByText(es.profile.saved)).toHaveCount(0)
})
