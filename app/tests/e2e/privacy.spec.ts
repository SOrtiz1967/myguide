// Spec 011: «Tus datos» de punta a punta (descargar datos y fotos, eliminar la cuenta con sus archivos, aislamiento y accesibilidad).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { es } from '../../src/copy/es'
import {
  dbQuery,
  login,
  PASSWORD,
  register,
  resetRateLimits,
  stubTurnstile,
  uniqueEmail,
} from './support'

const c = es.privacy
const fixture = (name: string) => join(import.meta.dirname, '..', 'fixtures', name)

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const objects = (email: string) =>
  dbQuery(
    `select count(*) from storage.objects o join auth.users u on o.name like u.id::text || '/%' where o.bucket_id in ('progress-photos','meal-photos') and u.email = '${email}'`,
  )

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

async function expectNoHorizontalScroll(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `Desplazamiento horizontal en ${name}`).toBeLessThanOrEqual(0)
}

async function uploadProgressPhoto(page: Page) {
  await page.goto('/fotos')
  const f = es.progressPhotos
  await page.getByLabel(f.upload.file, { exact: true }).setInputFiles(fixture('con-gps.jpg'))
  await page.getByLabel(f.upload.date).fill('2026-10-30')
  await page.getByRole('button', { name: f.upload.submit }).click()
  await expect(page.getByText(f.upload.saved)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('descargar los datos y las fotos: el contenido es el propio y nada de otra cuenta', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('priv')
  await register(page, email)
  dbQuery(
    `insert into public.supplements (user_id, name, client_request_id) values (${userOf(email)}, 'Creatina propia', gen_random_uuid())`,
  )
  await uploadProgressPhoto(page)

  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('otra'))
  dbQuery(
    `insert into public.supplements (user_id, name, client_request_id) values ((select id from auth.users order by created_at desc limit 1), 'Magnesio ajeno', gen_random_uuid())`,
  )
  await other.close()

  await page.goto('/privacidad')
  const [dataDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: c.export.data }).click(),
  ])
  expect(dataDownload.suggestedFilename()).toMatch(/^myguide-datos-\d{4}-\d{2}-\d{2}\.json$/)
  const json = readFileSync((await dataDownload.path())!, 'utf8')
  expect(json).toContain('Creatina propia')
  expect(json).not.toContain('Magnesio ajeno')
  expect(JSON.parse(json).account.email).toBe(email)
  await expect(page.getByText(c.export.dataReady)).toBeVisible()

  const [photosDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: c.export.photos }).click(),
  ])
  expect(photosDownload.suggestedFilename()).toMatch(/^myguide-fotos-.*\.zip$/)
  const zip = readFileSync((await photosDownload.path())!)
  expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304')
  expect(zip.toString('latin1')).toContain('fotos-de-progreso/2026-10-30-sin-pose.jpg')
  await expect(page.getByText(c.export.photosReady(1))).toBeVisible()
})

test('eliminar la cuenta borra los registros y los archivos y no deja volver a ingresar', async ({
  page,
}) => {
  const email = uniqueEmail('priv')
  await register(page, email)
  dbQuery(
    `insert into public.supplements (user_id, name, client_request_id) values (${userOf(email)}, 'Creatina', gen_random_uuid())`,
  )
  await uploadProgressPhoto(page)
  expect(objects(email)).toBe('1')

  await page.goto('/privacidad')
  await page.getByRole('button', { name: c.delete.open }).click()

  // Contraseña incorrecta: no se elimina nada.
  await page.getByLabel(c.delete.password).fill('otra-clave-incorrecta-9')
  await page.getByLabel(c.delete.confirmLabel(c.delete.phrase)).fill(c.delete.phrase)
  await page.getByRole('button', { name: c.delete.submit }).click()
  await expect(page.getByRole('alert')).toContainText(c.delete.errors.invalid_password)
  expect(dbQuery(`select count(*) from auth.users where email = '${email}'`)).toBe('1')
  expect(objects(email)).toBe('1')

  await page.getByLabel(c.delete.password).fill(PASSWORD)
  await page.getByRole('button', { name: c.delete.submit }).click()
  await expect(page).toHaveURL(/\/ingresar/)
  await expect(page.getByText(es.auth.accountDeleted)).toBeVisible()

  expect(dbQuery(`select count(*) from auth.users where email = '${email}'`)).toBe('0')
  expect(
    dbQuery(
      `select count(*) from public.supplements s where not exists (select 1 from auth.users u where u.id = s.user_id)`,
    ),
  ).toBe('0')
  expect(
    dbQuery(
      `select count(*) from storage.objects where bucket_id = 'progress-photos' and name not like '%/%'`,
    ),
  ).toBe('0')

  // Ya no puede ingresar.
  await login(page, email)
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toHaveCount(0)
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}: Tus datos`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await register(page, uniqueEmail('priva'))
    await page.goto('/privacidad')
    await expect(page.getByRole('heading', { level: 1, name: c.title })).toBeVisible()
    await expectNoViolations(page, `Tus datos (${label})`)
    await expectNoHorizontalScroll(page, `Tus datos (${label})`)

    await page.getByRole('button', { name: c.delete.open }).click()
    await page.getByRole('button', { name: c.delete.submit }).click()
    await expect(page.getByText(c.delete.errors.password)).toBeVisible()
    await expectNoViolations(page, `Tus datos con errores (${label})`)
    await expectNoHorizontalScroll(page, `Tus datos con errores (${label})`)
  })
}
