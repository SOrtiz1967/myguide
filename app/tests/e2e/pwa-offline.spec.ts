// T064 (FR-019, FR-020, escenario 14): sin conexión la app avisa y nunca da algo por guardado.
import { expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 14: abrir la app instalada sin conexión muestra el aviso, no datos', async ({
  page,
  context,
}) => {
  await register(page, uniqueEmail())
  await page.goto('/perfil')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // el service worker ya controla la página

  await context.setOffline(true)
  await page.reload()

  // La carcasa carga desde el service worker y avisa con claridad que no hay conexión.
  await expect(page.getByRole('alert').filter({ hasText: es.offline.banner })).toBeVisible()

  // Al volver la conexión el aviso desaparece.
  await context.setOffline(false)
  await expect(page.getByRole('alert').filter({ hasText: es.offline.banner })).toHaveCount(0)
})

test('escenario 14 (FR-020): guardar sin conexión informa que no está disponible y no muestra éxito', async ({
  page,
  context,
}) => {
  await register(page, uniqueEmail())
  await page.goto('/perfil')
  await expect(page.getByLabel(es.profile.labels.height)).toBeVisible()
  await page.getByLabel(es.profile.labels.height).fill('180')

  await context.setOffline(true)
  await page.getByRole('button', { name: es.profile.save }).click()

  await expect(page.getByRole('alert').filter({ hasText: es.errors.offline })).toBeVisible()
  await expect(page.getByText(es.profile.saved)).toHaveCount(0)
  // Lo escrito se conserva, y el borrador sigue en el dispositivo.
  await expect(page.getByLabel(es.profile.labels.height)).toHaveValue('180')

  await context.setOffline(false)
})

test('FR-019: la pantalla /sin-conexion solo informa, sin formularios ni datos', async ({
  page,
}) => {
  await page.goto('/sin-conexion')
  await expect(page.getByRole('heading', { level: 1, name: es.offline.pageTitle })).toBeVisible()
  await expect(page.getByText(es.offline.pageBody)).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
})
