// Spec 007: sueño, pasos y actividad — registrar, reemplazar el mismo día, corregir, eliminar, aislamiento y accesibilidad.
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

const a = es.activity
const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))
const display = (iso: string) => iso.split('-').reverse().join('/')
const valueField = (page: Page) => page.getByLabel(/^(Horas dormidas|Pasos|Minutos de actividad)/)

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    name,
  ).toEqual([])
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('registrar el sueño de hoy y de un día pasado, reemplazar el mismo día y verlo en el inicio', async ({
  page,
}) => {
  const email = uniqueEmail('ac')
  await register(page, email)
  await page.goto('/actividad')
  await expect(page.getByText(a.noData)).toHaveCount(3)

  await valueField(page).fill('7:30')
  await page.getByRole('button', { name: a.form.save }).click()
  await expect(page.getByText(a.form.saved)).toBeVisible()
  await expect(page.getByText(`7 h 30 min · ${display(day(0))}`)).toBeVisible()

  await page.getByLabel(a.form.date).fill(day(-2))
  await valueField(page).fill('6,75')
  await page.getByRole('button', { name: a.form.save }).click()
  await expect(page.getByText(`${display(day(-2))}: 6 h 45 min · Registro manual`)).toBeVisible()

  // el mismo día reemplaza al anterior
  await page.getByLabel(a.form.date).fill(day(0))
  await valueField(page).fill('8:00')
  await page.getByRole('button', { name: a.form.save }).click()
  await expect(page.getByText(`${display(day(0))}: 8 h · Registro manual`)).toBeVisible()
  expect(
    dbQuery(
      `select count(*) from public.daily_activity where user_id = ${userOf(email)} and kind = 'sleep'`,
    ),
  ).toBe('2')

  await page.goto('/')
  await expect(page.getByRole('link', { name: /Último sueño/ })).toContainText('8 h')
})

test('pasos y actividad, validaciones, corregir y eliminar', async ({ page }) => {
  const email = uniqueEmail('ac')
  await register(page, email)
  await page.goto('/actividad')

  await valueField(page).fill('25:00')
  await page.getByRole('button', { name: a.form.save }).click()
  await expect(page.getByText(/entre 1 minuto y 24 horas/)).toBeVisible()
  expect(
    dbQuery(`select count(*) from public.daily_activity where user_id = ${userOf(email)}`),
  ).toBe('0')

  await page.getByLabel(a.form.kind, { exact: true }).selectOption('steps')
  await valueField(page).fill('8.500')
  await page.getByRole('button', { name: a.form.save }).click()
  await expect(page.getByText(`${display(day(0))}: 8.500 pasos · Registro manual`)).toBeVisible()

  await page.getByRole('button', { name: /Corregir/ }).click()
  await valueField(page).fill('9000')
  await page.getByRole('button', { name: a.form.save }).click()
  await expect(page.getByText(a.form.corrected)).toBeVisible()
  await expect(page.getByText(`${display(day(0))}: 9.000 pasos · Registro manual`)).toBeVisible()

  await page.getByRole('button', { name: /Eliminar/ }).click()
  await expect(page.getByRole('dialog', { name: a.delete.title })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Eliminar/ }).click()
  await page.getByRole('button', { name: a.delete.confirm }).click()
  await expect(page.getByText(a.delete.done)).toBeVisible()
  expect(
    dbQuery(`select count(*) from public.daily_activity where user_id = ${userOf(email)}`),
  ).toBe('0')
})

test('borrador al recargar, accesibilidad y aislamiento entre cuentas', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('ac')
  await register(page, email)
  await page.goto('/actividad')
  await valueField(page).fill('7:15')
  await page.reload()
  await expect(page.getByText(a.form.draftRestored)).toBeVisible()
  await expect(valueField(page)).toHaveValue('7:15')
  await expectNoViolations(page, 'actividad')

  dbQuery(
    `insert into public.daily_activity (user_id, kind, value, activity_date, client_request_id) values (${userOf(email)}, 'steps', 5000, '${day(-1)}', gen_random_uuid())`,
  )
  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('ac'))
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
  const read = await fetch(`${SUPABASE_URL}/rest/v1/daily_activity?select=*`, { headers })
  expect(await read.json()).toEqual([])
  const insert = await fetch(`${SUPABASE_URL}/rest/v1/daily_activity`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind: 'steps', value: 1 }),
  })
  expect(insert.status).toBeGreaterThanOrEqual(400)
  const remove = await fetch(`${SUPABASE_URL}/rest/v1/daily_activity?kind=eq.steps`, {
    method: 'DELETE',
    headers,
  })
  expect([200, 204]).toContain(remove.status)
  expect(
    dbQuery(`select count(*) from public.daily_activity where user_id = ${userOf(email)}`),
  ).toBe('1')
  await other.close()
})
