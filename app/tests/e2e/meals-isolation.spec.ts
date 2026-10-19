// T068 (spec 003, escenario 26 del quickstart): por la API real, una cuenta no ve ni cambia lo de otra.
// Usa el token de una sesión válida de la cuenta B, igual que lo haría el cliente, contra los datos de A.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import {
  clearSeededEntries,
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
  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, body: unknown) => call('POST', path, body),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    delete: (path: string) => call('DELETE', path),
    rpc: (name: string, body: unknown) => call('POST', `rpc/${name}`, body),
  }
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([{ id: 'iso1', name: 'Aislamiento comidas e2e', energy: 100 }])
})

test.afterAll(() => {
  clearSeededEntries()
  clearSeededFoods()
})

test.beforeEach(() => {
  resetRateLimits()
})

test('escenario 26: la cuenta B no ve ni cambia los ítems, marcas y fotos de A', async ({
  page,
  browser,
}) => {
  await stubTurnstile(page)
  const emailA = uniqueEmail('a')
  await register(page, emailA)
  const userA = `(select id from auth.users where email = '${emailA}')`
  const entryId = dbQuery(
    `select tests.create_meal_entry(${userA}, '${today()}', 'lunch', (select id from public.foods where source_item_id = 'E2E-iso1'), 100)`,
  )
  dbQuery(`insert into public.log_day_starts (user_id, log_date) values (${userA}, '${today()}')`)
  dbQuery(
    `insert into public.meal_photos (user_id, log_date, meal, storage_path, width, height, bytes) values (${userA}, '${today()}', 'lunch', 'ruta/ajena.jpg', 10, 10, 100)`,
  )
  const ownFood = dbQuery(
    `select tests.create_food(${userA}, 'Alimento propio de A e2e', null, 100, '100g', 1, 1, 1)`,
  )

  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('b'))
  const b = api(await accessToken(other))
  const state = () =>
    dbQuery(
      `select energy_kcal || '|' || quantity || '|' || meal || '|' || log_date from public.meal_entries where id = '${entryId}'`,
    )
  const before = state()

  // Lectura: nada de A es visible.
  for (const table of ['meal_entries', 'log_day_starts', 'meal_photos']) {
    const res = await b.get(`${table}?select=*`)
    expect(res.status, table).toBe(200)
    expect(await res.json(), `${table} de A visible para B`).toEqual([])
  }
  const byId = await b.get(`meal_entries?id=eq.${entryId}&select=*`)
  expect(await byId.json()).toEqual([])

  // Escritura directa: no hay permisos de insertar ni modificar; borrar solo alcanza lo propio.
  const insert = await b.post('meal_entries', {
    log_date: today(),
    meal: 'lunch',
    origin: 'manual',
    food_name: 'Intruso',
    energy_kcal: 1,
  })
  expect(insert.status).toBeGreaterThanOrEqual(400)
  const update = await b.patch(`meal_entries?id=eq.${entryId}`, { quantity: 1 })
  expect(update.status).toBeGreaterThanOrEqual(400)
  const remove = await b.delete(`meal_entries?id=eq.${entryId}`)
  expect([200, 204]).toContain(remove.status)
  expect(await remove.text()).not.toContain(entryId)
  const mark = await b.post('log_day_starts', { log_date: today() })
  expect(mark.status).toBeGreaterThanOrEqual(400)
  const photo = await b.post('meal_photos', {
    log_date: today(),
    meal: 'lunch',
    storage_path: 'x/y.jpg',
    width: 1,
    height: 1,
    bytes: 1,
  })
  expect(photo.status).toBeGreaterThanOrEqual(400)
  const photoDelete = await b.delete('meal_photos?meal=eq.lunch')
  expect(photoDelete.status).toBeGreaterThanOrEqual(400)

  // Funciones: no aceptan ítems ni alimentos ajenos.
  const edit = await b.rpc('update_meal_entry', { id: entryId, changes: { quantity: 1 } })
  expect(edit.status).toBeGreaterThanOrEqual(400)
  expect(await edit.text()).toContain('not_found')
  const foreignFood = await b.rpc('add_meal_entry', {
    entry: { log_date: today(), meal: 'lunch', food_id: ownFood, quantity: 100 },
    request_id: crypto.randomUUID(),
  })
  expect(foreignFood.status).toBeGreaterThanOrEqual(400)
  expect(await foreignFood.text()).toContain('not_found')
  const repeat = await b.rpc('repeat_meal', {
    from_date: today(),
    from_meal: 'lunch',
    to_date: today(),
    to_meal: 'dinner',
    request_id: crypto.randomUUID(),
  })
  expect(await repeat.json()).toEqual([{ created: 0, recalculated: 0, copied: 0 }])
  const preview = await b.rpc('preview_repeat_meal', { from_date: today(), from_meal: 'lunch' })
  expect(await preview.json()).toEqual([{ total: 0, recalculated: 0, copied: 0 }])
  const recents = await b.rpc('recent_meal_items', { max_items: 20 })
  expect(await recents.json()).toEqual([])
  // La marca de inicio de día solo admite el "hoy" de cada cuenta.
  const start = await b.rpc('start_log_day', { day: '2000-01-01' })
  expect(start.status).toBeGreaterThanOrEqual(400)

  // Sin sesión (solo la clave pública) tampoco se ve ni se llama a nada.
  const anonymous = await fetch(`${SUPABASE_URL}/rest/v1/meal_entries?select=*`, {
    headers: { apikey: ANON_KEY },
  })
  expect(anonymous.status).toBeGreaterThanOrEqual(400)
  const anonymousRpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/repeat_meal`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_date: today(),
      from_meal: 'lunch',
      to_date: today(),
      to_meal: 'dinner',
      request_id: crypto.randomUUID(),
    }),
  })
  expect(anonymousRpc.status).toBeGreaterThanOrEqual(400)

  // Nada de A cambió.
  expect(state()).toBe(before)
  expect(dbQuery(`select count(*) from public.meal_entries where user_id = ${userA}`)).toBe('1')
  expect(dbQuery(`select count(*) from public.meal_photos where user_id = ${userA}`)).toBe('1')
  expect(dbQuery(`select count(*) from public.log_day_starts where user_id = ${userA}`)).toBe('1')
  expect(dbQuery("select count(*) from public.meal_entries where food_name = 'Intruso'")).toBe('0')
  await other.close()
})
