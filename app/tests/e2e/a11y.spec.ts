// T072 (FR-024): accesibilidad de las pantallas principales (axe) y recorrido completo por teclado.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { PASSWORD, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

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

for (const path of [
  '/registro',
  '/ingresar',
  '/recuperar',
  '/restablecer',
  '/sin-conexion',
  '/correo-confirmado',
  '/correo-no-valido',
]) {
  test(`axe: ${path} no tiene violaciones graves`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoViolations(page, path)
  })
}

test('axe: inicio y perfil (con sesión) no tienen violaciones graves', async ({ page }) => {
  await register(page, uniqueEmail())
  await expectNoViolations(page, '/')
  await page.goto('/perfil')
  await expect(page.getByRole('heading', { level: 1, name: es.profile.title })).toBeVisible()
  await expectNoViolations(page, '/perfil')
})

test('teclado: el formulario de ingreso se recorre con Tab y se envía con Enter', async ({
  page,
}) => {
  const email = uniqueEmail()
  await register(page, email)
  await page.getByRole('button', { name: es.auth.actions.logout }).click()
  await page.goto('/ingresar')

  // El primer Tab lleva al enlace para saltar al contenido.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: es.common.skipToContent })).toBeFocused()

  await page.getByLabel(es.auth.labels.email).focus()
  await expect(page.getByLabel(es.auth.labels.email)).toBeFocused()
  await page.keyboard.type(email)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel(es.auth.labels.password)).toBeFocused()
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
})

test('teclado: todos los controles del registro son alcanzables y muestran el foco', async ({
  page,
}) => {
  await page.goto('/registro')
  const reached: string[] = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const style = getComputedStyle(el)
      return {
        label: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.id,
        tag: el.tagName,
        outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
      }
    })
    if (info) {
      reached.push(info.tag)
      expect(info.outline, `sin foco visible en ${info.label}`).toBe(true)
    }
  }
  expect(reached).toContain('INPUT')
  expect(reached).toContain('BUTTON')
})

test('un error del formulario queda asociado al campo y se anuncia', async ({ page }) => {
  await page.goto('/registro')
  await page.getByLabel(es.auth.labels.email).fill('no-es-correo')
  await page.getByRole('button', { name: es.auth.actions.register }).click()
  const email = page.getByLabel(es.auth.labels.email)
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  const describedBy = await email.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  await expect(page.locator(`#${describedBy!.split(' ').pop()}`)).toHaveText(es.common.emailInvalid)
})
