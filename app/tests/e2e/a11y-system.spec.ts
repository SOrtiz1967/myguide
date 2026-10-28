// Spec 017: accesibilidad del sistema de diseño (axe), sin desborde horizontal y con zoom alto.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    `Violaciones de accesibilidad en ${name}`,
  ).toEqual([])
}

async function expectNoHorizontalScroll(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `Desborde horizontal en ${name}`).toBeLessThanOrEqual(0)
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

for (const width of [375, 1280]) {
  test(`inicio, referencia del sistema y formularios a ${width} px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 800 })
    await register(page, uniqueEmail('sys'))
    for (const path of ['/', '/sistema', '/medidas', '/comidas', '/entrenamiento', '/perfil']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      // La referencia del sistema muestra a propósito un estado de carga fijo.
      if (path !== '/sistema') {
        await expect(page.getByText(/Cargando/)).toHaveCount(0, { timeout: 20_000 })
      }
      await expectNoViolations(page, `${path} a ${width} px`)
      await expectNoHorizontalScroll(page, `${path} a ${width} px`)
    }
  })
}
