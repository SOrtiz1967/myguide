// T065 (FR-018, FR-019, SC-008): la aplicación cumple los requisitos de instalación y no guarda datos en caché.
import { expect, test } from '@playwright/test'
import { PASSWORD, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

interface WebManifest {
  name: string
  short_name: string
  lang: string
  start_url: string
  scope: string
  display: string
  theme_color: string
  background_color: string
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>
}

test('SC-008: el manifiesto cumple los requisitos de instalación', async ({ page, request }) => {
  await page.goto('/ingresar')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()

  const res = await request.get(new URL(href!, page.url()).toString())
  expect(res.ok()).toBe(true)
  const manifest = (await res.json()) as WebManifest

  expect(manifest.name).toBe('MyGuide')
  expect(manifest.lang).toBe('es')
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/')
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)

  const sizes = manifest.icons.map((icon) => icon.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)

  // Cada ícono declarado existe y es un PNG.
  for (const icon of manifest.icons) {
    const iconRes = await request.get(new URL(icon.src, page.url()).toString())
    expect(iconRes.ok(), icon.src).toBe(true)
    expect(iconRes.headers()['content-type']).toContain('image/png')
    const bytes = await iconRes.body()
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  }
})

test('SC-008: hay ícono de pantalla de inicio, color de tema y un service worker activo', async ({
  page,
}) => {
  await page.goto('/ingresar')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1)

  const active = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return Boolean(registration.active)
  })
  expect(active).toBe(true)
})

test('FR-019: el service worker solo guarda la carcasa y nunca llamadas de datos', async ({
  page,
}) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail(), PASSWORD)
  await page.goto('/perfil')
  await page.evaluate(() => navigator.serviceWorker.ready)

  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) urls.push(request.url)
    }
    return urls
  })

  expect(cached.length).toBeGreaterThan(0)
  for (const url of cached) {
    expect(url, 'solo recursos de la propia aplicación').toMatch(/^http:\/\/localhost:4173\//)
    expect(url).not.toMatch(/\/(rest|auth|functions|storage)\/v1|supabase|127\.0\.0\.1/)
  }
})
