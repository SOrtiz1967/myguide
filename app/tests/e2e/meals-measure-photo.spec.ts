// T069 (spec 003): medición de la foto de 12 MP (tamaño final y tiempo de la función meal-photo).
// Corre sobre el servidor de desarrollo porque la función solo admite ese origen en el entorno local.
import { expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededEntries,
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  uniqueEmail,
} from './support'

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

let email = ''
const user = () => `(select id from auth.users where email = '${email}')`

test.beforeAll(() => {
  clearSeededEntries()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  email = uniqueEmail()
  await register(page, email)
})

// Fotos sintéticas de 4000×3000 (12 MP) codificadas como JPEG en el propio navegador. El ruido
// de una foto real de teléfono es moderado; "extremo" es ruido casi puro, el peor caso para JPEG.
const CASES = [
  { name: 'ruido típico', noise: 20, limit: 500 * 1024 },
  { name: 'ruido extremo', noise: 90, limit: 3 * 1024 * 1024 },
]

for (const { name, noise, limit } of CASES) {
  test(`foto de 12 MP con ${name}: tamaño final y tiempo de la función`, async ({ page }) => {
    test.setTimeout(120_000)
    const original = await page.evaluate(async (amplitude) => {
      const canvas = document.createElement('canvas')
      canvas.width = 4000
      canvas.height = 3000
      const ctx = canvas.getContext('2d')!
      const channel = (base: number) => ((base + Math.random() * amplitude) % 256) | 0
      for (let y = 0; y < 3000; y += 6) {
        for (let x = 0; x < 4000; x += 6) {
          ctx.fillStyle = `rgb(${channel(x / 20)},${channel(y / 14)},${channel((x + y) / 30)})`
          ctx.fillRect(x, y, 6, 6)
        }
      }
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92),
      )
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    }, noise)
    const buffer = Buffer.from(original)

    await page.goto(`/comidas/${today()}`)
    const lunch = page.getByRole('region', { name: es.meals.names.lunch })
    const request = page.waitForResponse(
      (r) => r.url().includes('/functions/v1/meal-photo') && r.request().method() === 'POST',
    )
    const started = Date.now()
    await lunch
      .getByLabel(es.meals.photo.add)
      .setInputFiles({ name: 'doce-mp.jpg', mimeType: 'image/jpeg', buffer })
    const response = await request
    const timing = response.request().timing()
    await expect(lunch.getByText(es.meals.photo.uploaded)).toBeVisible()
    const totalMs = Date.now() - started
    const stored = Number(
      dbQuery(`select bytes from public.meal_photos where user_id = ${user()} and meal = 'lunch'`),
    )
    const functionMs = timing.responseEnd - timing.requestStart
    console.log(
      `MEDICION foto (${name}): original ${(buffer.length / 1024).toFixed(0)} KB; guardada ${(stored / 1024).toFixed(0)} KB; función ${functionMs.toFixed(0)} ms; de elegir a "subida" ${totalMs} ms`,
    )
    expect(stored).toBeLessThan(limit)
    expect(functionMs).toBeLessThan(2000)
  })
}
