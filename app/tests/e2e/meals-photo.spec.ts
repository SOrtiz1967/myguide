// T061 (spec 003, escenarios 22 a 25 del quickstart): la foto opcional de una comida.
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { es } from '../../src/copy/es'
import {
  clearSeededEntries,
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  SUPABASE_URL,
  uniqueEmail,
} from './support'

const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name)
const original = readFileSync(fixture('con-gps.jpg'))

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

const FUNCTION = `${SUPABASE_URL}/functions/v1/meal-photo`

/** El token de la sesión de la página, para llamar a la función como lo haría el navegador. */
async function tokenOf(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
    if (!key) throw new Error('sin sesión')
    return (JSON.parse(localStorage.getItem(key) ?? '{}') as { access_token: string }).access_token
  })
}

const photoRows = (email: string) =>
  dbQuery(
    `select count(*) from public.meal_photos p join auth.users u on u.id = p.user_id where u.email = '${email}'`,
  )

const objects = (email: string) =>
  dbQuery(
    `select count(*) from storage.objects o join auth.users u on o.name like u.id::text || '/%' where o.bucket_id = 'meal-photos' and u.email = '${email}'`,
  )

const storagePath = (email: string, meal: string) =>
  dbQuery(
    `select p.storage_path from public.meal_photos p join auth.users u on u.id = p.user_id where u.email = '${email}' and p.meal = '${meal}'`,
  )

const asText = (bytes: Buffer) => bytes.toString('latin1')

test.beforeAll(() => {
  clearSeededEntries()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 22: una foto con GPS se guarda sin metadatos y pesa menos', async ({ page }) => {
  const email = uniqueEmail()
  await register(page, email)
  const external: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue()
    external.push(url.href)
    return route.abort()
  })

  await page.goto(`/comidas/${today()}`)
  const lunch = page.getByRole('region', { name: es.meals.names.lunch })
  await lunch.getByLabel(es.meals.photo.add).setInputFiles(fixture('con-gps.jpg'))
  const image = lunch.getByRole('img', { name: /^Foto de Almuerzo/ })
  await expect(image).toBeVisible()
  await expect(lunch.getByText(es.meals.photo.uploaded)).toBeVisible()

  // Se descarga lo que quedó guardado: sin EXIF, sin GPS, sin el fabricante de la cámara y más chico.
  const saved = await (await page.request.get((await image.getAttribute('src'))!)).body()
  expect([saved[0], saved[1]]).toEqual([0xff, 0xd8])
  expect(asText(saved)).not.toContain('Exif')
  expect(asText(saved)).not.toContain('MarcaDePruebaCamara')
  expect(asText(saved)).not.toContain('comentario-privado-de-prueba')
  expect(saved.length).toBeLessThan(original.length)

  // El servidor no confía en el navegador: una foto con GPS enviada sin pasar por la reducción también se limpia.
  const direct = await page.request.post(FUNCTION, {
    headers: { authorization: `Bearer ${await tokenOf(page)}` },
    multipart: {
      log_date: today(),
      meal: 'dinner',
      photo: { name: 'cruda.jpg', mimeType: 'image/jpeg', buffer: original },
    },
  })
  expect(direct.status()).toBe(200)
  const stored = await (
    await page.request.get(
      `${SUPABASE_URL}/storage/v1/object/authenticated/meal-photos/${storagePath(email, 'dinner')}`,
      { headers: { authorization: `Bearer ${await tokenOf(page)}` } },
    )
  ).body()
  expect([stored[0], stored[1]]).toEqual([0xff, 0xd8])
  expect(asText(stored)).not.toContain('Exif')
  expect(asText(stored)).not.toContain('MarcaDePruebaCamara')

  // Una URL firmada vencida ya no sirve (se firma por 2 s y se espera a que venza).
  const signed = await page.request.post(
    `${SUPABASE_URL}/storage/v1/object/sign/meal-photos/${storagePath(email, 'dinner')}`,
    {
      headers: { authorization: `Bearer ${await tokenOf(page)}` },
      data: { expiresIn: 2 },
    },
  )
  expect(signed.status()).toBe(200)
  const shortLived = `${SUPABASE_URL}/storage/v1${((await signed.json()) as { signedURL: string }).signedURL}`
  expect((await page.request.get(shortLived)).status()).toBe(200)
  await page.waitForTimeout(3500)
  expect((await page.request.get(shortLived)).status()).toBeGreaterThanOrEqual(400)

  expect(external, `peticiones a terceros: ${external.join(', ')}`).toEqual([])
})

test('escenario 23: otra cuenta o una petición anónima no pueden leer ni modificar la foto', async ({
  page,
  browser,
}) => {
  const emailA = uniqueEmail('dueno')
  await register(page, emailA)
  await page.goto(`/comidas/${today()}`)
  const lunch = page.getByRole('region', { name: es.meals.names.lunch })
  await lunch.getByLabel(es.meals.photo.add).setInputFiles(fixture('con-gps.jpg'))
  await expect(lunch.getByRole('img', { name: /^Foto de Almuerzo/ })).toBeVisible()
  const path = storagePath(emailA, 'lunch')
  expect(path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/)

  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('otra'))
  const tokenB = await tokenOf(other)

  const targets = [
    `${SUPABASE_URL}/storage/v1/object/authenticated/meal-photos/${path}`,
    `${SUPABASE_URL}/storage/v1/object/public/meal-photos/${path}`,
  ]
  for (const url of targets) {
    const asOther = await other.request.get(url, { headers: { authorization: `Bearer ${tokenB}` } })
    expect(asOther.status(), `otra cuenta: ${url}`).toBeGreaterThanOrEqual(400)
    const asAnonymous = await other.request.get(url)
    expect(asAnonymous.status(), `anónimo: ${url}`).toBeGreaterThanOrEqual(400)
  }
  // Tampoco puede pedir una URL firmada de una ruta ajena.
  const sign = await other.request.post(
    `${SUPABASE_URL}/storage/v1/object/sign/meal-photos/${path}`,
    {
      headers: { authorization: `Bearer ${tokenB}` },
      data: { expiresIn: 600 },
    },
  )
  expect(sign.status()).toBeGreaterThanOrEqual(400)

  // Y sin sesión la función rechaza la subida y el borrado.
  const noSession = await other.request.delete(`${FUNCTION}?log_date=${today()}&meal=lunch`)
  expect(noSession.status()).toBe(401)
  // Borrar "mi" almuerzo desde la otra cuenta no toca el de la dueña.
  const ownDelete = await other.request.delete(`${FUNCTION}?log_date=${today()}&meal=lunch`, {
    headers: { authorization: `Bearer ${tokenB}` },
  })
  expect(ownDelete.status()).toBe(204)
  expect(photoRows(emailA)).toBe('1')
  expect(objects(emailA)).toBe('1')
  await other.close()
})

test('escenario 24: reemplazar y eliminar deja la anterior fuera de servicio', async ({ page }) => {
  const email = uniqueEmail()
  await register(page, email)
  await page.goto(`/comidas/${today()}`)
  const lunch = page.getByRole('region', { name: es.meals.names.lunch })
  await lunch.getByLabel(es.meals.photo.add).setInputFiles(fixture('con-gps.jpg'))
  const image = lunch.getByRole('img', { name: /^Foto de Almuerzo/ })
  await expect(image).toBeVisible()
  const firstUrl = (await image.getAttribute('src'))!
  expect((await page.request.get(firstUrl)).status()).toBe(200)

  // Reemplazar: la anterior deja de estar disponible (FR-034) y queda una sola.
  await lunch.getByLabel(es.meals.photo.replace).setInputFiles(fixture('con-xmp-iptc.jpg'))
  await expect(lunch.getByText(es.meals.photo.uploaded)).toBeVisible()
  await expect.poll(async () => (await image.getAttribute('src')) !== firstUrl).toBe(true)
  const secondUrl = (await image.getAttribute('src'))!
  expect((await page.request.get(firstUrl)).status()).toBeGreaterThanOrEqual(400)
  expect((await page.request.get(secondUrl)).status()).toBe(200)
  expect(photoRows(email)).toBe('1')
  expect(objects(email)).toBe('1')

  // Eliminar, con confirmación.
  await lunch.getByRole('button', { name: es.meals.photo.remove }).click()
  const dialog = page.getByRole('dialog', { name: es.meals.photo.deleteTitle })
  await dialog.getByRole('button', { name: es.meals.photo.cancel }).click()
  expect(photoRows(email)).toBe('1')
  await lunch.getByRole('button', { name: es.meals.photo.remove }).click()
  await page
    .getByRole('dialog', { name: es.meals.photo.deleteTitle })
    .getByRole('button', { name: es.meals.photo.confirmDelete })
    .click()
  await expect(lunch.getByText(es.meals.photo.removed)).toBeVisible()
  await expect(lunch.getByLabel(es.meals.photo.add)).toBeAttached()
  expect(photoRows(email)).toBe('0')
  expect(objects(email)).toBe('0')
  expect((await page.request.get(secondUrl)).status()).toBeGreaterThanOrEqual(400)
})

test('escenario 25: lo que no es imagen o es demasiado grande se rechaza con un mensaje claro', async ({
  page,
}) => {
  const email = uniqueEmail()
  await register(page, email)
  await page.goto(`/comidas/${today()}`)
  const lunch = page.getByRole('region', { name: es.meals.names.lunch })
  const input = lunch.getByLabel(es.meals.photo.add)

  await input.setInputFiles(fixture('no-es-imagen.txt'))
  await expect(lunch.getByRole('alert')).toHaveText(es.meals.photo.errors.notImage)

  await input.setInputFiles({
    name: 'enorme.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(16 * 1024 * 1024, 1),
  })
  await expect(lunch.getByRole('alert')).toHaveText(es.meals.photo.errors.tooBig)

  await input.setInputFiles({
    name: 'IMG_0001.heic',
    mimeType: 'image/heic',
    buffer: Buffer.from('no es un heic de verdad'),
  })
  await expect(lunch.getByRole('alert')).toHaveText(es.meals.photo.errors.heic)

  expect(photoRows(email)).toBe('0')
  expect(objects(email)).toBe('0')
})
