// T056 (spec 005, FR-023, FR-028, SC-008): por la API real, el catálogo es de solo lectura y los
// ejercicios propios son privados. Usa el token de una sesión válida, igual que lo haría el cliente.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { clearSeededExercises, seedCatalogExercises } from './exercises-support'
import {
  dbQuery,
  register,
  resetRateLimits,
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
  clearSeededExercises()
  seedCatalogExercises([{ id: 'ro1', name: 'Catalogo solo lectura e2e' }])
})

test.afterAll(() => {
  clearSeededExercises()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('FR-028: con una sesión válida no se puede insertar, modificar ni borrar el catálogo', async ({
  page,
}) => {
  await register(page, uniqueEmail('exro'))
  const client = api(await accessToken(page))
  const catalogId = dbQuery("select id from public.exercises where source_item_id = 'E2E-ro1'")

  // insertar directo en la tabla (también un falso «catálogo»): rechazado
  const insert = await client.post('exercises', {
    origin: 'imported',
    name: 'Falso catalogo e2e',
    measurement_type: 'duration',
  })
  expect(insert.ok).toBe(false)
  const insertOwn = await client.post('exercises', {
    origin: 'own',
    name: 'Directo e2e',
    measurement_type: 'duration',
  })
  expect(insertOwn.ok).toBe(false)

  // modificar y borrar el catálogo: sin permiso o sin filas afectadas
  const update = await client.patch(`exercises?id=eq.${catalogId}`, { name: 'Hackeado e2e' })
  expect(update.ok ? await update.json() : []).toEqual([])
  const remove = await client.delete(`exercises?id=eq.${catalogId}`)
  expect(await remove.json()).toEqual([])

  // las funciones tampoco lo permiten: update_exercise sobre el catálogo es not_found
  const viaFunction = await client.post('rpc/update_exercise', {
    id: catalogId,
    exercise: { name: 'Hackeado e2e', measurement_type: 'duration' },
  })
  expect(viaFunction.ok).toBe(false)
  expect(JSON.stringify(await viaFunction.json())).toContain('not_found')

  expect(dbQuery(`select name from public.exercises where id = '${catalogId}'`)).toBe(
    'Catalogo solo lectura e2e',
  )
  expect(dbQuery("select count(*) from public.exercises where name ilike '%hackeado%'")).toBe('0')
  expect(
    dbQuery(
      "select count(*) from public.exercises where name in ('Falso catalogo e2e', 'Directo e2e')",
    ),
  ).toBe('0')
})

test('FR-023: una cuenta no puede leer, modificar ni borrar los ejercicios propios de otra', async ({
  page,
  browser,
}) => {
  await register(page, uniqueEmail('exa'))
  const clientA = api(await accessToken(page))
  const created = await clientA.post('rpc/create_exercise', {
    exercise: { name: 'Propio de A e2e', measurement_type: 'duration' },
    request_id: crypto.randomUUID(),
  })
  expect(created.ok).toBe(true)
  const id = (await created.json()) as string

  const context = await browser.newContext()
  const other = await context.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('exb'))
  const clientB = api(await accessToken(other))

  expect(await (await clientB.get(`exercises?id=eq.${id}`)).json()).toEqual([])
  const update = await clientB.patch(`exercises?id=eq.${id}`, { name: 'Robado e2e' })
  expect(update.ok ? await update.json() : []).toEqual([])
  expect(await (await clientB.delete(`exercises?id=eq.${id}`)).json()).toEqual([])
  const viaFunction = await clientB.post('rpc/update_exercise', {
    id,
    exercise: { name: 'Robado e2e', measurement_type: 'duration' },
  })
  expect(viaFunction.ok).toBe(false)
  const copy = await clientB.post('rpc/copy_exercise', { id, request_id: crypto.randomUUID() })
  expect(copy.ok).toBe(false)
  expect(dbQuery(`select name from public.exercises where id = '${id}'`)).toBe('Propio de A e2e')
  expect(dbQuery("select count(*) from public.exercises where name = 'Robado e2e'")).toBe('0')

  // Y A sí ve lo suyo.
  expect(await (await clientA.get(`exercises?id=eq.${id}`)).json()).toHaveLength(1)
  await context.close()
})
