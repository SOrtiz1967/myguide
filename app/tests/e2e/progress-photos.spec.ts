// Spec 019: fotos de progreso, de punta a punta (subida limpia, orden, corrección, comparación, eliminación y aislamiento).
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { es } from '../../src/copy/es'
import {
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  SUPABASE_URL,
  uniqueEmail,
} from './support'

const c = es.progressPhotos
const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name)
const original = readFileSync(fixture('con-gps.jpg'))
const asText = (bytes: Buffer) => bytes.toString('latin1')

const FUNCTION = `${SUPABASE_URL}/functions/v1/progress-photo`

/** El token de la sesión de la página, para llamar a la función como lo haría el navegador. */
async function tokenOf(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
    if (!key) throw new Error('sin sesión')
    return (JSON.parse(localStorage.getItem(key) ?? '{}') as { access_token: string }).access_token
  })
}

const rows = (email: string) =>
  dbQuery(
    `select count(*) from public.progress_photos p join auth.users u on u.id = p.user_id where u.email = '${email}'`,
  )

const objects = (email: string) =>
  dbQuery(
    `select count(*) from storage.objects o join auth.users u on o.name like u.id::text || '/%' where o.bucket_id = 'progress-photos' and u.email = '${email}'`,
  )

const firstPath = (email: string) =>
  dbQuery(
    `select p.storage_path from public.progress_photos p join auth.users u on u.id = p.user_id where u.email = '${email}' order by p.created_at limit 1`,
  )

async function upload(page: Page, date: string, pose: string | null) {
  await page.getByLabel(c.upload.file, { exact: true }).setInputFiles(fixture('con-gps.jpg'))
  await page.getByLabel(c.upload.date).fill(date)
  await page.getByLabel(c.upload.pose).selectOption(pose ?? '')
  await page.getByRole('button', { name: c.upload.submit }).click()
  await expect(page.getByText(c.upload.saved)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('sube una foto con GPS: queda sin metadatos, privada y sin llamadas a terceros', async ({
  page,
}) => {
  const email = uniqueEmail()
  await register(page, email)
  const external: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue()
    external.push(url.href)
    return route.abort()
  })

  await page.goto('/fotos')
  await expect(page.getByRole('heading', { level: 1, name: c.title })).toBeVisible()
  await expect(page.getByText(c.list.emptyTitle)).toBeVisible()
  await upload(page, '2026-10-20', 'front')

  const image = page.getByRole('img', { name: /^Foto de progreso del .* 20 de octubre, frente/ })
  await expect(image).toBeVisible()
  expect(rows(email)).toBe('1')
  expect(objects(email)).toBe('1')

  // Lo guardado: JPEG sin EXIF ni GPS ni el fabricante de la cámara, y más chico que el original.
  const saved = await (await page.request.get((await image.getAttribute('src'))!)).body()
  expect([saved[0], saved[1]]).toEqual([0xff, 0xd8])
  expect(asText(saved)).not.toContain('Exif')
  expect(asText(saved)).not.toContain('MarcaDePruebaCamara')
  expect(asText(saved)).not.toContain('comentario-privado-de-prueba')
  expect(saved.length).toBeLessThan(original.length)

  // El servidor no confía en el navegador: una foto con GPS enviada sin reducir también se limpia.
  const direct = await page.request.post(FUNCTION, {
    headers: { authorization: `Bearer ${await tokenOf(page)}` },
    multipart: {
      taken_on: '2026-10-21',
      photo: { name: 'cruda.jpg', mimeType: 'image/jpeg', buffer: original },
    },
  })
  expect(direct.status()).toBe(200)
  expect(rows(email)).toBe('2')
  const rawPath = dbQuery(
    `select p.storage_path from public.progress_photos p join auth.users u on u.id = p.user_id where u.email = '${email}' and p.taken_on = date '2026-10-21'`,
  )
  const stored = await (
    await page.request.get(
      `${SUPABASE_URL}/storage/v1/object/authenticated/progress-photos/${rawPath}`,
      { headers: { authorization: `Bearer ${await tokenOf(page)}` } },
    )
  ).body()
  expect(asText(stored)).not.toContain('Exif')
  expect(asText(stored)).not.toContain('MarcaDePruebaCamara')

  expect(external, `peticiones a terceros: ${external.join(', ')}`).toEqual([])
})

test('ordena por fecha, corrige fecha y pose, y elimina con su archivo', async ({ page }) => {
  const email = uniqueEmail()
  await register(page, email)
  await page.goto('/fotos')
  await upload(page, '2026-09-01', 'front')
  await upload(page, '2026-10-20', 'side')

  // De la más reciente a la más antigua.
  const headings = page
    .getByRole('region', { name: c.list.title })
    .getByRole('heading', { level: 3 })
  await expect(headings).toHaveText(['martes 20 de octubre', 'martes 1 de septiembre'])

  // Corrige la fecha de la más antigua: pasa a ser la más reciente. El archivo no cambia.
  const pathBefore = firstPath(email)
  await page.getByRole('button', { name: /Abrir la foto del martes 1 de septiembre/ }).click()
  const viewer = page.getByRole('region', { name: /Foto abierta/ })
  await expect(viewer).toBeVisible()
  await viewer.getByLabel(c.upload.date).fill('2026-10-25')
  await viewer.getByLabel(c.upload.pose).selectOption('back')
  await viewer.getByRole('button', { name: c.viewer.save }).click()
  await expect(viewer.getByText(c.viewer.saved)).toBeVisible()
  await expect(headings).toHaveText(['domingo 25 de octubre', 'martes 20 de octubre'])
  expect(firstPath(email)).toBe(pathBefore)
  expect(
    dbQuery(`select pose from public.progress_photos where storage_path = '${pathBefore}'`),
  ).toBe('back')

  // Eliminar pide confirmación; cancelar no borra nada.
  await viewer.getByRole('button', { name: c.viewer.delete }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: c.viewer.cancel }).click()
  expect(rows(email)).toBe('2')

  await viewer.getByRole('button', { name: c.viewer.delete }).click()
  await page.getByRole('dialog').getByRole('button', { name: c.viewer.confirmDelete }).click()
  await expect(page.getByRole('region', { name: /Foto abierta/ })).toHaveCount(0)
  await expect(headings).toHaveText(['martes 20 de octubre'])
  expect(rows(email)).toBe('1')
  expect(objects(email)).toBe('1')
})

test('compara dos fotos lado a lado y avisa si las poses difieren', async ({ page }) => {
  await register(page, uniqueEmail())
  await page.goto('/fotos')
  await upload(page, '2026-09-01', 'front')
  await upload(page, '2026-10-20', 'side')

  await page
    .getByRole('checkbox', { name: /Elegir para comparar la foto del martes 20 de octubre/ })
    .check()
  await expect(page.getByText(c.compare.pickOther)).toBeVisible()
  await page
    .getByRole('checkbox', { name: /Elegir para comparar la foto del martes 1 de septiembre/ })
    .check()

  const panel = page.getByRole('region', { name: c.compare.title })
  await expect(panel.getByRole('img')).toHaveCount(2)
  await expect(panel.getByText(c.compare.daysApart(49))).toBeVisible()
  await expect(panel.getByText(c.compare.differentPose)).toBeVisible()
  await expect(panel.getByText(c.compare.note)).toBeVisible()
  await expect(panel.getByText(/Anterior: martes 1 de septiembre, frente/)).toBeVisible()
  await expect(panel.getByText(/Posterior: martes 20 de octubre, perfil/)).toBeVisible()

  // La comparación sobrevive a una recarga (los ids van en la dirección).
  await page.reload()
  await expect(page.getByRole('region', { name: c.compare.title }).getByRole('img')).toHaveCount(2)
  await page.getByRole('button', { name: c.compare.clear }).click()
  await expect(page.getByRole('region', { name: c.compare.title })).toHaveCount(0)
})

test('otra cuenta o una petición anónima no pueden leer, borrar ni cambiar las fotos', async ({
  page,
  browser,
}) => {
  const emailA = uniqueEmail('dueno')
  await register(page, emailA)
  await page.goto('/fotos')
  await upload(page, '2026-10-20', 'front')
  const path = firstPath(emailA)
  const id = dbQuery(`select id from public.progress_photos where storage_path = '${path}'`)
  expect(path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/)

  const other = await browser.newPage()
  await stubTurnstile(other)
  const emailB = uniqueEmail('otra')
  await register(other, emailB)
  const tokenB = await tokenOf(other)

  for (const url of [
    `${SUPABASE_URL}/storage/v1/object/authenticated/progress-photos/${path}`,
    `${SUPABASE_URL}/storage/v1/object/public/progress-photos/${path}`,
  ]) {
    const asOther = await other.request.get(url, { headers: { authorization: `Bearer ${tokenB}` } })
    expect(asOther.status(), `otra cuenta: ${url}`).toBeGreaterThanOrEqual(400)
    expect((await other.request.get(url)).status(), `anónimo: ${url}`).toBeGreaterThanOrEqual(400)
  }

  // La otra cuenta no ve la foto en su lista, ni puede borrarla ni corregirla.
  await other.goto('/fotos')
  await expect(other.getByText(c.list.emptyTitle)).toBeVisible()
  const del = await other.request.delete(`${FUNCTION}?id=${id}`, {
    headers: { authorization: `Bearer ${tokenB}` },
  })
  expect(del.status()).toBe(204)
  expect(rows(emailA)).toBe('1')
  expect(objects(emailA)).toBe('1')
  // Corregir la foto de otra cuenta lo cubre la prueba pgTAP (photo_not_found); aquí la fecha sigue intacta.
  expect(dbQuery(`select taken_on from public.progress_photos where id = '${id}'`)).toBe(
    '2026-10-20',
  )

  // Sin sesión, la función no responde.
  const anonymous = await other.request.post(FUNCTION, {
    multipart: {
      taken_on: '2026-10-20',
      photo: { name: 'x.jpg', mimeType: 'image/jpeg', buffer: original },
    },
  })
  expect(anonymous.status()).toBe(401)
  await other.close()
})
