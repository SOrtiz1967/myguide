// T064 (spec 005, escenario 30, SC-007, FR-023, FR-028, FR-039): por la API real, una cuenta no ve ni cambia
// lo de otra, nadie modifica el catálogo, las funciones de carga solo las ejecuta `service_role` y una
// petición anónima no accede a nada. Usa el token de una sesión válida, igual que lo haría el cliente.
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

test.beforeAll(() => {
  clearSeededExercises()
  seedCatalogExercises([{ id: 'iso1', name: 'Catálogo de aislamiento e2e' }])
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

const catalogId = () => dbQuery("select id from public.exercises where source_item_id = 'E2E-iso1'")

test('escenario 30: la cuenta B no lee, inserta, modifica ni borra los ejercicios propios de A', async ({
  page,
  browser,
}) => {
  await register(page, uniqueEmail('a'))
  const a = api(await accessToken(page))
  const created = await a.rpc('create_exercise', {
    exercise: {
      name: 'Propio de A aislado e2e',
      measurement_type: 'reps_weight',
      primary_muscles: ['chest'],
      description: 'Descripción privada de A',
    },
    request_id: crypto.randomUUID(),
  })
  expect(created.ok).toBe(true)
  const id = (await created.json()) as string
  const state = () =>
    dbQuery(
      `select name || '|' || coalesce(description, '') from public.exercises where id = '${id}'`,
    )
  const before = state()

  const context = await browser.newContext()
  const other = await context.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('b'))
  const b = api(await accessToken(other))

  // lectura: nada de A es visible, ni por identificador ni por búsqueda
  expect(await (await b.get(`exercises?id=eq.${id}&select=*`)).json()).toEqual([])
  expect(await (await b.get('exercises?name=ilike.*aislado*&select=*')).json()).toEqual([])
  const searchBody = (q: string, scope: string) => ({
    q,
    scope,
    muscle_filter: null,
    equipment_filter: null,
    page_size: 20,
    page_offset: 0,
  })
  for (const scope of ['own', 'all']) {
    const res = await b.rpc('search_exercises', searchBody('propio de a aislado', scope))
    expect(res.ok, `búsqueda de B en «${scope}»`).toBe(true)
    expect(await res.json(), `búsqueda de B en «${scope}»`).toEqual([])
  }
  // control: la misma búsqueda de A sí la encuentra, así que el vacío de B no es por un error de la llamada
  const control = await a.rpc('search_exercises', searchBody('propio de a aislado', 'own'))
  expect(control.ok).toBe(true)
  expect(((await control.json()) as { id: string }[]).map((row) => row.id)).toEqual([id])

  // escritura directa: no hay permiso de insertar ni de modificar; borrar solo alcanza lo propio
  expect(
    (await b.post('exercises', { origin: 'own', name: 'Intruso', measurement_type: 'duration' }))
      .status,
  ).toBeGreaterThanOrEqual(400)
  const patch = await b.patch(`exercises?id=eq.${id}`, { name: 'Robado' })
  expect(patch.ok ? await patch.json() : []).toEqual([])
  expect(await (await b.delete(`exercises?id=eq.${id}`)).json()).toEqual([])

  // las funciones tampoco: ni editar ni copiar lo ajeno
  const update = await b.rpc('update_exercise', {
    id,
    exercise: { name: 'Robado', measurement_type: 'duration' },
  })
  expect(update.ok).toBe(false)
  expect(JSON.stringify(await update.json())).toContain('not_found')
  const copy = await b.rpc('copy_exercise', { id, request_id: crypto.randomUUID() })
  expect(copy.ok).toBe(false)
  expect(JSON.stringify(await copy.json())).toContain('not_found')

  expect(state()).toBe(before)
  expect(dbQuery("select count(*) from public.exercises where name in ('Intruso', 'Robado')")).toBe(
    '0',
  )

  // y A sí ve y puede lo suyo
  expect(await (await a.get(`exercises?id=eq.${id}&select=name`)).json()).toEqual([
    { name: 'Propio de A aislado e2e' },
  ])
  await context.close()
})

test('SC-007: nadie modifica el catálogo, ni siquiera con una sesión válida', async ({ page }) => {
  await register(page, uniqueEmail('cat'))
  const client = api(await accessToken(page))
  const id = catalogId()

  expect(
    (
      await client.post('exercises', {
        origin: 'imported',
        name: 'Falso',
        measurement_type: 'duration',
      })
    ).status,
  ).toBeGreaterThanOrEqual(400)
  const patch = await client.patch(`exercises?id=eq.${id}`, { name: 'Hackeado' })
  expect(patch.ok ? await patch.json() : []).toEqual([])
  expect(await (await client.delete(`exercises?id=eq.${id}`)).json()).toEqual([])
  const update = await client.rpc('update_exercise', {
    id,
    exercise: { name: 'Hackeado', measurement_type: 'duration' },
  })
  expect(update.ok).toBe(false)
  const fuentes = await client.patch('exercise_sources?slug=eq.free-exercise-db', { name: 'Otro' })
  expect(fuentes.ok ? await fuentes.json() : []).toEqual([])

  // el catálogo sí se puede leer
  expect(await (await client.get(`exercises?id=eq.${id}&select=name`)).json()).toEqual([
    { name: 'Catálogo de aislamiento e2e' },
  ])
  expect(dbQuery(`select name from public.exercises where id = '${id}'`)).toBe(
    'Catálogo de aislamiento e2e',
  )
  expect(dbQuery("select name from public.exercise_sources where slug = 'free-exercise-db'")).toBe(
    'free-exercise-db',
  )
})

test('FR-039: las funciones de carga no las ejecuta ninguna cuenta ni una petición anónima', async ({
  page,
}) => {
  await register(page, uniqueEmail('imp'))
  const logged = api(await accessToken(page))
  const anonymous = api(ANON_KEY)
  const importBody = { source_slug: 'free-exercise-db', items: [], drop_descriptions: false }
  const finishBody = { source_slug: 'free-exercise-db', report: {} }

  for (const [who, client] of [
    ['una cuenta con sesión', logged],
    ['una petición anónima', anonymous],
  ] as const) {
    const run = await client.rpc('import_exercises', importBody)
    expect(run.ok, `import_exercises con ${who}`).toBe(false)
    const finish = await client.rpc('finish_exercise_import', finishBody)
    expect(finish.ok, `finish_exercise_import con ${who}`).toBe(false)
  }
  expect(dbQuery("select count(*) from public.exercises where name = 'Intruso carga'")).toBe('0')
})

test('una petición anónima no accede a nada del catálogo ni de las cuentas', async () => {
  const anonymous = api(ANON_KEY)

  for (const path of ['exercises?select=*', 'exercise_sources?select=*']) {
    const res = await anonymous.get(path)
    const body = res.ok ? await res.json() : []
    expect(body, path).toEqual([])
  }
  expect(
    (
      await anonymous.post('exercises', {
        origin: 'own',
        name: 'Anónimo',
        measurement_type: 'duration',
      })
    ).ok,
  ).toBe(false)
  for (const [name, body] of [
    [
      'create_exercise',
      {
        exercise: { name: 'Anónimo', measurement_type: 'duration' },
        request_id: crypto.randomUUID(),
      },
    ],
    [
      'update_exercise',
      { id: crypto.randomUUID(), exercise: { name: 'X', measurement_type: 'duration' } },
    ],
    ['copy_exercise', { id: crypto.randomUUID(), request_id: crypto.randomUUID() }],
  ] as const) {
    const res = await anonymous.rpc(name, body)
    expect(res.ok, name).toBe(false)
  }
  expect(dbQuery("select count(*) from public.exercises where name = 'Anónimo'")).toBe('0')
})
