// T046 y escenarios 7, 8 y 15 del quickstart: aislamiento entre cuentas, acceso sin sesión y vencimiento.
import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  PASSWORD,
  SUPABASE_URL,
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  uniqueEmail,
} from './support'

const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? readAnonKey()

function readAnonKey(): string {
  // El mismo valor que usa el frontend en desarrollo (app/.env.local, no se sube a Git).
  const env = readFileSync('.env.local', 'utf8')
  return /^VITE_SUPABASE_ANON_KEY=(.+)$/m.exec(env)?.[1]?.trim() ?? ''
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

async function createAccount(request: APIRequestContext, email: string) {
  const res = await request.post(`${SUPABASE_URL}/functions/v1/register`, {
    headers: { apikey: ANON_KEY },
    data: {
      email,
      password: PASSWORD,
      turnstileToken: 'token-e2e',
      privacyNoticeVersion: '2026-10-16',
    },
  })
  expect(res.status()).toBe(201)
  const token = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY },
    data: { email, password: PASSWORD },
  })
  expect(token.ok()).toBe(true)
  const { access_token: accessToken } = (await token.json()) as { access_token: string }
  // Un inicio de sesión reciente reinicia el contador, como hace la app.
  const start = await request.post(`${SUPABASE_URL}/rest/v1/rpc/start_session`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    data: {},
  })
  expect(start.ok()).toBe(true)
  const id = dbQuery(`select id from auth.users where email = '${email}'`)
  return { id, accessToken }
}

const asUser = (accessToken: string) => ({
  apikey: ANON_KEY,
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

test('escenario 8 (FR-012): una ruta privada sin sesión redirige a ingresar sin pedir datos', async ({
  page,
}) => {
  const dataRequests: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('/rest/v1/')) dataRequests.push(req.url())
  })
  await page.goto('/perfil')
  await expect(page).toHaveURL(/\/ingresar$/)
  await expect(page.getByRole('heading', { level: 1, name: es.auth.titles.login })).toBeVisible()
  expect(dataRequests).toEqual([])
})

test('escenario 8 (FR-012): la API sin sesión no devuelve ningún perfil', async ({ request }) => {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
    headers: { apikey: ANON_KEY },
  })
  expect(res.status()).toBeGreaterThanOrEqual(400)
  expect(await res.text()).not.toContain('privacy_notice_version')
})

test('escenario 7 (FR-009 a FR-011): la cuenta A no puede leer, modificar ni borrar datos de B', async ({
  request,
}) => {
  const a = await createAccount(request, uniqueEmail('a'))
  const b = await createAccount(request, uniqueEmail('b'))

  // A solo ve su propio perfil.
  const own = await request.get(`${SUPABASE_URL}/rest/v1/profiles?select=user_id`, {
    headers: asUser(a.accessToken),
  })
  expect((await own.json()) as Array<{ user_id: string }>).toEqual([{ user_id: a.id }])

  // El perfil de B se comporta como inexistente para A.
  const other = await request.get(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${b.id}`, {
    headers: asUser(a.accessToken),
  })
  expect(await other.json()).toEqual([])

  // Modificar el perfil de B no afecta ninguna fila.
  const patch = await request.patch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${b.id}`, {
    headers: asUser(a.accessToken),
    data: { height_cm: 99 },
  })
  expect(await patch.json()).toEqual([])
  expect(
    dbQuery(
      `select coalesce(height_cm::text, 'nulo') from public.profiles where user_id = '${b.id}'`,
    ),
  ).toBe('nulo')

  // El cliente no puede insertar ni borrar perfiles, ni tocar columnas protegidas.
  const insert = await request.post(`${SUPABASE_URL}/rest/v1/profiles`, {
    headers: asUser(a.accessToken),
    data: {
      user_id: a.id,
      privacy_notice_version: 'x',
      privacy_notice_accepted_at: new Date().toISOString(),
    },
  })
  expect(insert.status()).toBeGreaterThanOrEqual(400)
  const remove = await request.delete(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${a.id}`, {
    headers: asUser(a.accessToken),
  })
  expect(remove.status()).toBeGreaterThanOrEqual(400)
  const forge = await request.patch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${a.id}`, {
    headers: asUser(a.accessToken),
    data: { email_verified_at: new Date().toISOString() },
  })
  expect(forge.status()).toBeGreaterThanOrEqual(400)
  expect(
    dbQuery(`select email_verified_at is null from public.profiles where user_id = '${a.id}'`),
  ).toBe('t')
})

test('escenario 15 (FR-003): tras 31 días sin actividad la sesión vence y se pide ingresar', async ({
  page,
}) => {
  const email = uniqueEmail()
  await register(page, email)
  dbQuery(
    `update public.profiles set last_active_at = now() - interval '31 days' where user_id = (select id from auth.users where email = '${email}')`,
  )

  await page.reload()
  await expect(page).toHaveURL(/\/ingresar$/)
  await expect(page.getByText(es.auth.sessionExpired)).toBeVisible()

  // Con un inicio de sesión nuevo vuelve a funcionar.
  await page.getByLabel(es.auth.labels.email).fill(email)
  await page.getByLabel(es.auth.labels.password).fill(PASSWORD)
  await page.getByRole('button', { name: es.auth.actions.login }).click()
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
})
