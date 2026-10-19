// T034 (spec 002, SC-006, FR-016, FR-022): por la API real, el catálogo es de solo lectura y los
// alimentos propios son privados. Usa el token de una sesión válida, igual que lo haría el cliente.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import {
  clearSeededFoods,
  dbQuery,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  SUPABASE_URL,
  uniqueEmail,
} from './support'

const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? readAnonKey()

function readAnonKey(): string {
  // El mismo valor que usa el frontend en desarrollo (app/.env.local, no se sube a Git).
  const env = readFileSync('.env.local', 'utf8')
  return /^VITE_SUPABASE_ANON_KEY=(.+)$/m.exec(env)?.[1]?.trim() ?? ''
}

async function accessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
    return key ? (JSON.parse(localStorage.getItem(key) ?? '{}').access_token as string) : ''
  })
}

function api(token: string) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
  return {
    get: (path: string) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers }),
    post: (path: string, body: unknown) =>
      fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
    patch: (path: string, body: unknown) =>
      fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      }),
    delete: (path: string) =>
      fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers }),
  }
}

test.beforeAll(() => {
  clearSeededFoods()
  seedCatalogFoods([{ id: 'ro1', name: 'Catalogo solo lectura e2e', energy: 100 }])
})

test.afterAll(() => {
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('SC-006: con una sesión válida no se puede insertar, modificar ni borrar el catálogo', async ({
  page,
}) => {
  await register(page, uniqueEmail())
  const client = api(await accessToken(page))

  const insert = await client.post('foods', {
    origin: 'imported',
    name: 'Falso catalogo',
    reference_basis: '100g',
    energy_kcal: 1,
  })
  expect(insert.ok).toBe(false)

  const update = await client.patch('foods?name=eq.Catalogo solo lectura e2e', { energy_kcal: 1 })
  expect(await update.json()).toEqual([])
  const remove = await client.delete('foods?name=eq.Catalogo solo lectura e2e')
  expect(await remove.json()).toEqual([])

  expect(
    dbQuery("select energy_kcal from public.foods where name = 'Catalogo solo lectura e2e'"),
  ).toBe('100.00')
  expect(dbQuery("select count(*) from public.foods where name = 'Falso catalogo'")).toBe('0')
})

test('FR-016: una cuenta no puede leer, modificar ni borrar los alimentos propios de otra', async ({
  page,
  browser,
}) => {
  await register(page, uniqueEmail('a'))
  const clientA = api(await accessToken(page))
  const created = await clientA.post('rpc/create_food', {
    food: { name: 'Propio de A e2e', reference_basis: '100g', energy_kcal: 50 },
    portions: [],
    request_id: crypto.randomUUID(),
  })
  expect(created.ok).toBe(true)

  const context = await browser.newContext()
  const other = await context.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('b'))
  const clientB = api(await accessToken(other))

  expect(await (await clientB.get('foods?name=eq.Propio de A e2e')).json()).toEqual([])
  expect(
    await (await clientB.patch('foods?name=eq.Propio de A e2e', { energy_kcal: 999 })).json(),
  ).toEqual([])
  expect(await (await clientB.delete('foods?name=eq.Propio de A e2e')).json()).toEqual([])
  expect(dbQuery("select energy_kcal from public.foods where name = 'Propio de A e2e'")).toBe(
    '50.00',
  )

  // Y A sí ve lo suyo.
  expect(await (await clientA.get('foods?name=eq.Propio de A e2e')).json()).toHaveLength(1)
  await context.close()
})
