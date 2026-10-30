// Spec 019 (FR-020, FR-021, SC-005, SC-007): accesibilidad de las fotos de progreso (axe), teclado y sin desborde a 375 px.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { es } from '../../src/copy/es'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const c = es.progressPhotos
const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name)

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

async function upload(page: Page, date: string, pose: string) {
  await page.getByLabel(c.upload.file, { exact: true }).setInputFiles(fixture('con-gps.jpg'))
  await page.getByLabel(c.upload.date).fill(date)
  await page.getByLabel(c.upload.pose).selectOption(pose)
  await page.getByRole('button', { name: c.upload.submit }).click()
  await expect(page.getByText(c.upload.saved)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  resetRateLimits()
  await stubTurnstile(page)
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}: vacío, lista, foto abierta y comparación`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await register(page, uniqueEmail('fot'))
    await page.goto('/fotos')
    await expect(page.getByText(c.list.emptyTitle)).toBeVisible()
    await expectNoViolations(page, `vacío (${label})`)
    await expectNoHorizontalScroll(page, `vacío (${label})`)

    await upload(page, '2026-09-01', 'front')
    await upload(page, '2026-10-20', 'side')
    await expect(page.getByRole('img')).toHaveCount(2)
    await expectNoViolations(page, `lista (${label})`)
    await expectNoHorizontalScroll(page, `lista (${label})`)

    await page.getByRole('button', { name: /Abrir la foto del martes 20 de octubre/ }).click()
    await expect(page.getByRole('region', { name: /Foto abierta/ })).toBeVisible()
    await expectNoViolations(page, `foto abierta (${label})`)
    await expectNoHorizontalScroll(page, `foto abierta (${label})`)
    await page.getByRole('button', { name: c.viewer.close, exact: true }).click()

    await page.getByRole('checkbox', { name: /comparar la foto del martes 20 de octubre/ }).check()
    await page
      .getByRole('checkbox', { name: /comparar la foto del martes 1 de septiembre/ })
      .check()
    const panel = page.getByRole('region', { name: c.compare.title })
    await expect(panel.getByRole('img')).toHaveCount(2)
    await expectNoViolations(page, `comparación (${label})`)
    await expectNoHorizontalScroll(page, `comparación (${label})`)
  })
}

test('teclado: se sube, se elige para comparar y se abre una foto sin ratón', async ({ page }) => {
  await register(page, uniqueEmail('fot'))
  await page.goto('/fotos')
  await upload(page, '2026-10-20', 'front')

  const open = page.getByRole('button', { name: /Abrir la foto del martes 20 de octubre/ })
  await open.focus()
  await page.keyboard.press('Enter')
  const viewer = page.getByRole('region', { name: /Foto abierta/ })
  await expect(viewer).toBeVisible()
  // El foco pasa al título de la foto abierta, para que el lector de pantalla lo anuncie.
  await expect(viewer.getByRole('heading', { level: 2 })).toBeFocused()

  await page.getByRole('button', { name: c.viewer.close, exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(viewer).toHaveCount(0)

  const choose = page.getByRole('checkbox', { name: /comparar la foto del martes 20 de octubre/ })
  await choose.focus()
  await page.keyboard.press('Space')
  await expect(choose).toBeChecked()
  await expect(page.getByText(c.compare.pickOther)).toBeVisible()
})
