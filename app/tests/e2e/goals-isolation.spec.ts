// T047 (spec 004, escenario 28 del quickstart, SC-007): por la API real, una cuenta no ve ni cambia el
// objetivo de otra. Usa el token de una sesión válida de la cuenta B, igual que lo haría el cliente.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { savedGoals, seedGoal, localDate } from './goals-support'
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
    Authorization: `Bearer ${token ?? ANON_KEY}`,
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

test.beforeEach(() => {
  resetRateLimits()
})

test('escenario 28: la cuenta B y una petición anónima no ven ni cambian el objetivo de A', async ({
  page,
  browser,
}) => {
  await stubTurnstile(page)
  const emailA = uniqueEmail('goala')
  await register(page, emailA)
  const tokenA = await accessToken(page)
  seedGoal(emailA, 2000, localDate(-3), new Date(Date.now() - 3 * 86400000).toISOString())
  const rowId = dbQuery(
    `select id from public.energy_goals where user_id = (select id from auth.users where email = '${emailA}')`,
  )

  const other = await browser.newPage()
  await stubTurnstile(other)
  const emailB = uniqueEmail('goalb')
  await register(other, emailB)
  const b = api(await accessToken(other))
  const before = savedGoals(emailA)

  // Lectura: nada de A es visible para B.
  const read = await b.get('energy_goals?select=*')
  expect(read.status).toBe(200)
  expect(await read.json(), 'el historial de A es visible para B').toEqual([])
  const byId = await b.get(`energy_goals?id=eq.${rowId}&select=*`)
  expect(await byId.json()).toEqual([])

  // Escritura directa: el cliente no puede insertar, actualizar ni borrar nada (ni lo propio ni lo ajeno).
  const userA = dbQuery(`select id from auth.users where email = '${emailA}'`)
  const insert = await b.post('energy_goals', {
    user_id: userA,
    effective_from: localDate(),
    kcal: 1500,
    client_request_id: crypto.randomUUID(),
  })
  expect(insert.status, 'insertar a nombre de A').toBeGreaterThanOrEqual(400)
  const update = await b.patch(`energy_goals?id=eq.${rowId}`, { kcal: 1500 })
  expect(update.status, 'actualizar la fila de A').toBeGreaterThanOrEqual(400)
  const remove = await b.delete(`energy_goals?id=eq.${rowId}`)
  expect(remove.status, 'borrar la fila de A').toBeGreaterThanOrEqual(400)

  // La función solo escribe para quien llama: B cambia SU objetivo y el de A no se toca.
  const rpc = await b.rpc('set_energy_goal', {
    kcal: 1700,
    request_id: crypto.randomUUID(),
    client_timezone: 'UTC',
  })
  expect(rpc.status).toBe(200)
  expect(savedGoals(emailB)).toEqual(['1700'])
  expect(savedGoals(emailA)).toEqual(before)

  // B tampoco puede reutilizar el identificador de solicitud de A para ver o pisar su fila.
  const requestOfA = dbQuery(
    `select client_request_id from public.energy_goals where id = '${rowId}'`,
  )
  const replay = await b.rpc('set_energy_goal', {
    kcal: 1100,
    request_id: requestOfA,
    client_timezone: 'UTC',
  })
  expect(replay.status).toBe(200)
  expect(savedGoals(emailA)).toEqual(before)
  expect(savedGoals(emailB)).toEqual(['1700', '1100'])

  // Una petición anónima no accede a la tabla ni ejecuta la función.
  const anon = api(null)
  expect((await anon.get('energy_goals?select=*')).status).toBeGreaterThanOrEqual(400)
  expect(
    (
      await anon.rpc('set_energy_goal', {
        kcal: 1800,
        request_id: crypto.randomUUID(),
        client_timezone: 'UTC',
      })
    ).status,
  ).toBeGreaterThanOrEqual(400)

  // La versión con la hora como parámetro no está expuesta por la API (406: no existe en `public`).
  const hidden = await b.rpc('set_energy_goal_at', {
    p_user: userA,
    p_kcal: 1000,
    p_request: crypto.randomUUID(),
    p_now: new Date().toISOString(),
    p_zone: 'UTC',
  })
  expect(hidden.status).toBeGreaterThanOrEqual(400)
  expect(savedGoals(emailA)).toEqual(before)

  // Con la sesión de A todo sigue siendo suyo (control: la prueba no pasa por estar rota).
  const own = await api(tokenA).get('energy_goals?select=kcal')
  expect(await own.json()).toEqual([{ kcal: 2000 }])
})
