// T027: cuentas de punta a punta contra Supabase local (escenarios 1 a 6, 16 y 18 del quickstart).
import { expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  PASSWORD,
  confirmEmail,
  linkIn,
  login,
  messagesFor,
  register,
  resetRateLimits,
  sessionCount,
  stubTurnstile,
  uniqueEmail,
  waitForMail,
} from './support'

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 1 (FR-029): el registro no avanza sin marcar el aviso de privacidad', async ({
  page,
}) => {
  await page.goto('/registro')
  await page.getByLabel(es.auth.labels.email).fill(uniqueEmail())
  await page.getByLabel(es.auth.labels.password).fill(PASSWORD)
  await page.getByRole('button', { name: es.auth.actions.register }).click()
  await expect(page.getByText(es.auth.privacyRequired)).toBeVisible()
  await expect(page).toHaveURL(/\/registro$/)
})

test('escenario 2 (FR-001, FR-026): alta, recordatorio, confirmación por enlace y recordatorio fuera', async ({
  page,
}) => {
  const email = uniqueEmail()
  await register(page, email)

  // La cuenta se puede usar de inmediato y se recuerda confirmar el correo.
  await expect(page.getByText(es.auth.verifyBanner)).toBeVisible()

  await confirmEmail(page, email)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
  await expect(page.getByText(es.auth.verifyBanner)).toHaveCount(0)
})

test('escenario 18: registrarse con un correo repetido muestra el mensaje claro', async ({
  page,
}) => {
  const email = uniqueEmail()
  await register(page, email)
  await page.getByRole('button', { name: es.auth.actions.logout }).click()

  await page.goto('/registro')
  await page.getByLabel(es.auth.labels.email).fill(email)
  await page.getByLabel(es.auth.labels.password).fill(PASSWORD)
  await page.getByLabel(es.auth.labels.privacyAccept).check()
  await page.getByRole('button', { name: es.auth.actions.register }).click()
  await expect(page.getByRole('alert')).toContainText(es.errors.accountExists)
})

test('escenario 16 (FR-007): un doble clic en "Crear cuenta" resulta en una sola cuenta', async ({
  page,
}) => {
  const email = uniqueEmail()
  await page.goto('/registro')
  await page.getByLabel(es.auth.labels.email).fill(email)
  await page.getByLabel(es.auth.labels.password).fill(PASSWORD)
  await page.getByLabel(es.auth.labels.privacyAccept).check()
  await page.getByRole('button', { name: es.auth.actions.register }).dblclick()
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()

  await waitForMail(email, /confirma tu correo/i)
  const confirmations = (await messagesFor(email)).filter((m) =>
    /confirma tu correo/i.test(m.Subject),
  )
  expect(confirmations).toHaveLength(1)
})

test('escenario 5 (FR-005): contraseña errónea y correo inexistente dan el mismo mensaje', async ({
  page,
}) => {
  const email = uniqueEmail()
  await register(page, email)
  await page.getByRole('button', { name: es.auth.actions.logout }).click()

  await login(page, email, 'otra-clave-equivocada-1')
  const wrongPassword = await page.getByRole('alert').innerText()

  await login(page, uniqueEmail('nadie'), 'otra-clave-equivocada-1')
  const unknownEmail = await page.getByRole('alert').innerText()

  expect(wrongPassword).toBe(es.errors.invalidCredentials)
  expect(unknownEmail).toBe(wrongPassword)
})

test('escenarios 3 y 4 (FR-004, FR-027, FR-030): recuperar solo con correo confirmado y cerrar todas las sesiones', async ({
  page,
}) => {
  const email = uniqueEmail()
  const newPassword = 'una-clave-nueva-larga-2'
  await register(page, email)
  await page.getByRole('button', { name: es.auth.actions.logout }).click()

  // Escenario 3: sin confirmar, la respuesta es neutral y NO llega ningún correo de recuperación.
  await page.goto('/recuperar')
  await page.getByLabel(es.auth.labels.email).fill(email)
  await page.getByRole('button', { name: es.auth.actions.sendLink }).click()
  await expect(page.getByRole('status')).toContainText(es.auth.recoverySent)
  await page.waitForTimeout(2500)
  expect(
    (await messagesFor(email)).filter((m) => /reset|contraseña|password/i.test(m.Subject)),
  ).toHaveLength(0)

  // Escenario 4: con el correo confirmado, el correo llega y permite fijar una contraseña nueva.
  await confirmEmail(page, email)
  await page.goto('/recuperar')
  await page.getByLabel(es.auth.labels.email).fill(email)
  await page.getByRole('button', { name: es.auth.actions.sendLink }).click()
  await expect(page.getByRole('status')).toContainText(es.auth.recoverySent)

  const mail = await waitForMail(email, /reset|contraseña|password/i)
  await page.goto(linkIn(mail, /http\S+auth\/v1\/verify\S+/))
  await expect(page).toHaveURL(/\/restablecer/)
  await page.getByLabel(es.auth.labels.newPassword, { exact: true }).fill(newPassword)
  await page.getByLabel(es.auth.labels.confirmPassword).fill(newPassword)
  await page.getByRole('button', { name: es.auth.actions.savePassword }).click()
  await expect(page.getByText(es.auth.passwordReset)).toBeVisible()

  // FR-030: restablecer cierra TODAS las sesiones anteriores.
  expect(sessionCount(email)).toBe(0)

  // La contraseña vieja ya no sirve y la nueva sí.
  await login(page, email, PASSWORD)
  await expect(page.getByRole('alert')).toContainText(es.errors.invalidCredentials)
  await login(page, email, newPassword)
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
})

test('escenario 6 (FR-028, FR-030): cambiar la contraseña cierra las demás sesiones y mantiene la actual', async ({
  browser,
}) => {
  const email = uniqueEmail()
  const newPassword = 'una-clave-nueva-larga-2'

  const contextA = await browser.newContext()
  const pageA = await contextA.newPage()
  await stubTurnstile(pageA)
  await register(pageA, email)

  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await login(pageB, email)
  await expect(pageB.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
  expect(sessionCount(email)).toBe(2)

  // Una contraseña actual incorrecta se rechaza con un mensaje claro y no cierra nada.
  await pageA.goto('/perfil')
  await pageA.getByLabel(es.auth.labels.currentPassword).fill('clave-incorrecta-larga')
  await pageA.getByLabel(es.auth.labels.newPassword, { exact: true }).fill(newPassword)
  await pageA.getByLabel(es.auth.labels.confirmPassword).fill(newPassword)
  await pageA.getByRole('button', { name: es.auth.actions.changePassword }).click()
  await expect(pageA.getByRole('alert')).toContainText(es.auth.currentPasswordWrong)
  expect(sessionCount(email)).toBe(2)

  // Con la contraseña actual correcta se cambia y queda solo la sesión de A.
  await pageA.getByLabel(es.auth.labels.currentPassword).fill(PASSWORD)
  await pageA.getByRole('button', { name: es.auth.actions.changePassword }).click()
  await expect(pageA.getByRole('status').filter({ hasText: es.auth.passwordChanged })).toBeVisible()
  await expect.poll(() => sessionCount(email)).toBe(1)

  // A sigue con sesión.
  await pageA.goto('/')
  await expect(pageA.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()

  await contextA.close()
  await contextB.close()
})
