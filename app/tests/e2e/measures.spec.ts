// Spec 008 (versión mínima): peso y medidas — registrar, reemplazar el mismo día, corregir, eliminar, aislamiento y accesibilidad.
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  SUPABASE_URL,
  uniqueEmail,
} from './support'

const m = es.measures
const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))
const display = (iso: string) => iso.split('-').reverse().join('/')
const valueField = (page: Page) => page.getByLabel(/^Valor \(/)

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`),
    name,
  ).toEqual([])
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('registrar el peso de hoy y de un día pasado, reemplazar el mismo día y ver lo último', async ({
  page,
}) => {
  const email = uniqueEmail('ms')
  await register(page, email)
  await page.goto('/medidas')
  await expect(page.getByText(m.noData)).toHaveCount(6)

  await valueField(page).fill('72,4')
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(m.form.saved)).toBeVisible()
  await expect(page.getByText(`72,4 kg · ${display(day(0))}`)).toBeVisible()

  // un día pasado
  await page.getByLabel(m.form.date).fill(day(-3))
  await valueField(page).fill('73')
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(`${display(day(-3))}: 73,0 kg`)).toBeVisible()

  // el mismo día reemplaza al anterior
  await page.getByLabel(m.form.date).fill(day(0))
  await valueField(page).fill('72,1')
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(`${display(day(0))}: 72,1 kg`)).toBeVisible()
  await expect(page.getByText(`${display(day(0))}: 72,4 kg`)).toHaveCount(0)
  expect(
    dbQuery(
      `select count(*) from public.body_measurements where user_id = ${userOf(email)} and kind = 'weight'`,
    ),
  ).toBe('2')

  // el inicio muestra el último peso
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Último peso/ })).toContainText('72,1 kg')
})

test('validaciones, otra medida, corregir y eliminar', async ({ page }) => {
  const email = uniqueEmail('ms')
  await register(page, email)
  await page.goto('/medidas')

  await valueField(page).fill('5')
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(/20 y 500 kg/)).toBeVisible()
  await valueField(page).fill('72 kg')
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(m.validation.format)).toBeVisible()
  expect(
    dbQuery(`select count(*) from public.body_measurements where user_id = ${userOf(email)}`),
  ).toBe('0')

  // una cintura
  await page.getByLabel(m.form.kind, { exact: true }).selectOption('waist')
  await valueField(page).fill('84')
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(`${display(day(0))}: 84,0 cm`)).toBeVisible()

  // corregir
  await page.getByRole('button', { name: /Corregir/ }).click()
  await valueField(page).fill('83,5')
  await page.getByRole('button', { name: m.form.save }).click()
  await expect(page.getByText(m.form.corrected)).toBeVisible()
  await expect(page.getByText(`${display(day(0))}: 83,5 cm`)).toBeVisible()

  // eliminar con confirmación
  await page.getByRole('button', { name: /Eliminar/ }).click()
  await expect(page.getByRole('dialog', { name: m.delete.title })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /Eliminar/ }).click()
  await page.getByRole('button', { name: m.delete.confirm }).click()
  await expect(page.getByText(m.delete.done)).toBeVisible()
  await expect(page.getByText(m.history.empty)).toBeVisible()
  expect(
    dbQuery(`select count(*) from public.body_measurements where user_id = ${userOf(email)}`),
  ).toBe('0')
})

test('el borrador se conserva al recargar, accesibilidad y aislamiento entre cuentas', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('ms')
  await register(page, email)
  await page.goto('/medidas')
  await valueField(page).fill('71,9')
  await page.reload()
  await expect(page.getByText(m.form.draftRestored)).toBeVisible()
  await expect(valueField(page)).toHaveValue('71,9')
  await expectNoViolations(page, 'medidas')

  // otra cuenta no ve ni cambia estos datos
  dbQuery(
    `insert into public.body_measurements (user_id, kind, value, measured_on, client_request_id) values (${userOf(email)}, 'weight', 70, '${day(-1)}', gen_random_uuid())`,
  )
  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('ms'))
  const token = await other.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
    return key ? (JSON.parse(localStorage.getItem(key) ?? '{}').access_token as string) : ''
  })
  const anon =
    process.env.VITE_SUPABASE_ANON_KEY ??
    /^VITE_SUPABASE_ANON_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim() ??
    ''
  const headers = {
    apikey: anon,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  const read = await fetch(`${SUPABASE_URL}/rest/v1/body_measurements?select=*`, { headers })
  expect(await read.json()).toEqual([])
  const insert = await fetch(`${SUPABASE_URL}/rest/v1/body_measurements`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind: 'weight', value: 1 }),
  })
  expect(insert.status).toBeGreaterThanOrEqual(400)
  const remove = await fetch(`${SUPABASE_URL}/rest/v1/body_measurements?kind=eq.weight`, {
    method: 'DELETE',
    headers,
  })
  expect([200, 204]).toContain(remove.status)
  expect(
    dbQuery(`select count(*) from public.body_measurements where user_id = ${userOf(email)}`),
  ).toBe('1')
  await other.close()
})
