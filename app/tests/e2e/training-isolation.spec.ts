// T075 (spec 006, escenario 46, SC-008): por la API real, una cuenta no ve ni cambia las rutinas y sesiones de otra.
// Usa el token de una sesión válida de la cuenta B, igual que lo haría el cliente, contra los datos de A.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
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

function api(token: string | null) {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
  if (token) headers.Authorization = `Bearer ${token}`
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

const today = () => new Intl.DateTimeFormat('en-CA').format(new Date())
const TABLES = [
  'routines',
  'routine_exercises',
  'workout_sessions',
  'session_plan_items',
  'session_exercises',
  'session_sets',
  'session_date_changes',
]

test.beforeAll(() => {
  clearSeededExercises()
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(() => {
  resetRateLimits()
})

test('escenario 46: la cuenta B no ve ni cambia las rutinas y sesiones de A', async ({
  page,
  browser,
}) => {
  await stubTurnstile(page)
  const emailA = uniqueEmail('a')
  await register(page, emailA)
  const userA = `(select id from auth.users where email = '${emailA}')`
  seedOwnExercise(emailA, { name: 'Press aislado e2e', measurement: 'reps_weight' })
  const exerciseId = dbQuery(
    `select id from public.exercises where user_id = ${userA} and name = 'Press aislado e2e'`,
  )
  const routineId = dbQuery(
    `select tests.create_routine(${userA}, 'Rutina de A e2e', array['${exerciseId}'::uuid], 3)`,
  )
  const doneId = dbQuery(
    `select tests.create_session(${userA}, date '${today()}', 'completed', '${routineId}', true)`,
  )
  const x = dbQuery(`select tests.add_session_exercise('${doneId}', '${exerciseId}')`)
  dbQuery(`select tests.add_session_set('${x}', 8, 60)`)
  const plannedId = dbQuery(
    `select tests.create_session(${userA}, date '2099-01-01', 'planned', '${routineId}', true)`,
  )
  const state = () =>
    dbQuery(
      `select (select count(*) from public.routines) || '|' || (select count(*) from public.workout_sessions) || '|' || (select string_agg(status || session_date, ',' order by id) from public.workout_sessions) || '|' || (select count(*) from public.session_sets) || '|' || (select name from public.routines where id = '${routineId}')`,
    )
  const before = state()

  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('b'))
  const b = api(await accessToken(other))

  // Lectura: nada de A es visible para B.
  for (const table of TABLES) {
    const res = await b.get(`${table}?select=*`)
    expect(res.status, table).toBe(200)
    expect(await res.json(), `${table} de A visible para B`).toEqual([])
  }
  expect(await (await b.get(`workout_sessions?id=eq.${doneId}&select=*`)).json()).toEqual([])

  // Escritura directa: no hay permisos de insertar ni modificar en ninguna tabla.
  for (const table of TABLES) {
    const insert = await b.post(table, {})
    expect(insert.status, `insert en ${table}`).toBeGreaterThanOrEqual(400)
    const update = await b.patch(`${table}?id=eq.${routineId}`, { name: 'Intruso' })
    expect(update.status, `update en ${table}`).toBeGreaterThanOrEqual(400)
  }
  // Borrar solo alcanza lo propio: lo de A sigue ahí.
  for (const table of ['routines', 'workout_sessions']) {
    const remove = await b.delete(`${table}?id=eq.${table === 'routines' ? routineId : doneId}`)
    expect([200, 204]).toContain(remove.status)
    expect(await remove.text()).not.toContain(doneId)
  }

  // Funciones: no aceptan rutinas, sesiones ni ejercicios ajenos.
  const calls: Array<[string, unknown]> = [
    [
      'plan_workout',
      { session_date: '2099-02-01', routine_id: routineId, request_id: crypto.randomUUID() },
    ],
    ['start_workout_from_routine', { routine_id: routineId, request_id: crypto.randomUUID() }],
    ['start_planned_workout', { id: plannedId, request_id: crypto.randomUUID() }],
    [
      'reschedule_workout',
      { id: plannedId, new_date: '2099-03-01', request_id: crypto.randomUUID() },
    ],
    ['cancel_workout', { id: plannedId }],
    ['set_workout_routine', { id: plannedId, routine_id: null }],
    [
      'save_workout',
      { id: doneId, payload: { exercises: [] }, expected_revision: 1, finish: false },
    ],
    ['duplicate_routine', { id: routineId, request_id: crypto.randomUUID() }],
    ['update_routine', { id: routineId, routine: { name: 'Intruso', exercises: [] } }],
    [
      'create_routine',
      {
        routine: { name: 'Con ejercicio ajeno', exercises: [{ exercise_id: exerciseId, sets: 3 }] },
        request_id: crypto.randomUUID(),
      },
    ],
  ]
  for (const [name, body] of calls) {
    const res = await b.rpc(name, body)
    expect(res.status, `${name} debe rechazar lo ajeno`).toBeGreaterThanOrEqual(400)
  }
  const history = await b.rpc('exercise_history', { exercise_id: exerciseId })
  expect(await history.json()).toEqual([])

  // Una petición anónima no accede a nada.
  const anon = api(null)
  for (const table of TABLES) {
    const res = await anon.get(`${table}?select=*`)
    expect(res.status, `anon en ${table}`).toBeGreaterThanOrEqual(400)
  }
  expect(
    (await anon.rpc('plan_workout', { session_date: '2099-02-01' })).status,
  ).toBeGreaterThanOrEqual(400)

  // Nada de A cambió.
  expect(state()).toBe(before)
  await other.close()
})
