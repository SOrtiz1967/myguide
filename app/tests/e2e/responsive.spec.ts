// T073 (SC-007, plan): las vistas funcionan en pantalla de teléfono y de escritorio, y la carcasa carga rápido.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const VIEWPORTS = [
  { name: 'teléfono', width: 375, height: 667 },
  { name: 'escritorio', width: 1280, height: 800 },
]

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal en ${where}`).toBeLessThanOrEqual(0)
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

for (const viewport of VIEWPORTS) {
  test.describe(`en ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const path of ['/registro', '/ingresar', '/recuperar', '/sin-conexion']) {
      test(`${path} se ve completa y sin desplazamiento horizontal`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expectNoHorizontalScroll(page, path)
      })
    }

    test('el flujo de alta y el perfil se pueden completar', async ({ page }) => {
      await register(page, uniqueEmail())
      await expectNoHorizontalScroll(page, 'inicio')

      await page.goto('/perfil')
      await expect(page.getByRole('heading', { level: 1, name: es.profile.title })).toBeVisible()
      await expectNoHorizontalScroll(page, 'perfil')

      await page.getByLabel(es.profile.labels.birthDate).fill('1990-05-17')
      await page.getByLabel(es.profile.labels.height).fill('171,5')
      await page.getByLabel(es.profile.labels.timezone).selectOption('America/Buenos_Aires')
      await page.getByRole('button', { name: es.profile.save }).click()
      await expect(page.getByText(es.profile.saved)).toBeVisible()
    })

    test('los botones tienen un área táctil de al menos 44 px', async ({ page }) => {
      await page.goto('/ingresar')
      const box = await page.getByRole('button', { name: es.auth.actions.login }).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    })
  })
}

test.describe('presupuesto de carga de la carcasa (plan: menos de 3 s en conexión móvil típica)', () => {
  test.use({ baseURL: 'http://localhost:4173', viewport: { width: 375, height: 667 } })

  test('la pantalla de ingreso carga en menos de 3 segundos con 4G simulado', async ({
    page,
    context,
  }) => {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 100, // ms de ida y vuelta
      downloadThroughput: (9 * 1024 * 1024) / 8, // 9 Mbps ("4G regular")
      uploadThroughput: (4.5 * 1024 * 1024) / 8,
    })

    const start = Date.now()
    await page.goto('/ingresar', { waitUntil: 'load' })
    await expect(page.getByRole('heading', { level: 1, name: es.auth.titles.login })).toBeVisible()
    const elapsed = Date.now() - start

    expect(elapsed, `la carga tardó ${elapsed} ms`).toBeLessThan(3000)
  })
})
