// T076 (spec 006, escenario 48): mediciones de SC-001 y SC-010 sobre la compilación de producción (puerto 4173).
// Imprime los resultados (para registrarlos en research.md) y comprueba los topes de la spec.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import {
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  SUPABASE_URL,
  uniqueEmail,
} from './support'

test.use({ baseURL: 'http://localhost:4173' })

const t = es.training
const e = t.editor
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ??
  /^VITE_SUPABASE_ANON_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim() ??
  ''

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const card = (page: Page, name: string) => page.getByRole('article', { name })

async function accessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
    return key ? (JSON.parse(localStorage.getItem(key) ?? '{}').access_token as string) : ''
  })
}

async function rpc(
  token: string,
  name: string,
  body: unknown,
): Promise<{ ms: number; body: unknown }> {
  const started = performance.now()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  const ms = performance.now() - started
  expect(res.status, `${name}: ${JSON.stringify(json).slice(0, 200)}`).toBeLessThan(300)
  return { ms, body: json }
}

test.beforeAll(() => {
  clearSeededExercises()
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('SC-001: empezar con una rutina y anotar la primera serie; una sesión de 3 ejercicios con 3 series', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const email = uniqueEmail('trm')
  await register(page, email)
  const names = ['Press e2e', 'Sentadilla e2e', 'Remo e2e']
  for (const name of names) seedOwnExercise(email, { name, measurement: 'reps_weight' })
  const ids = names.map((name) =>
    dbQuery(
      `select id from public.exercises where user_id = ${userOf(email)} and name = '${name}'`,
    ),
  )
  dbQuery(
    `select tests.create_routine(${userOf(email)}, 'Torso e2e', array[${ids.map((id) => `'${id}'::uuid`).join(',')}], 3)`,
  )
  let interactions = 0
  const click = async (action: Promise<unknown>) => {
    interactions++
    await action
  }

  // Parte 1: desde «Hoy», empezar con la rutina y anotar la primera serie.
  await page.goto('/entrenamiento')
  await expect(page.getByRole('button', { name: t.home.startWith('Torso e2e') })).toBeVisible()
  const first = performance.now()
  await click(page.getByRole('button', { name: t.home.startWith('Torso e2e') }).click())
  await expect(page.getByRole('button', { name: e.finish })).toBeVisible()
  await click(page.getByRole('button', { name: t.plan.doIt }).first().click())
  await click(page.getByLabel(e.fieldOfSet(t.fields.reps, 1)).fill('8'))
  const firstSetMs = performance.now() - first
  const firstSetInteractions = interactions

  // Parte 2: una sesión vacía de 3 ejercicios con 3 series cada uno (guion de toda la sesión).
  const started2 = performance.now()
  interactions = 0
  await expect(page.getByRole('status').first()).toHaveText(t.saveIndicator.saved, {
    timeout: 15_000,
  })
  await page.getByRole('button', { name: e.finish }).click()
  await page.goto('/entrenamiento')
  await click(page.getByRole('button', { name: t.home.startEmpty }).click())
  await expect(page.getByRole('button', { name: e.finish })).toBeVisible()
  for (const name of names) {
    await click(page.getByRole('button', { name: e.addExercise }).click())
    const dialog = page.getByRole('dialog', { name: t.picker.title })
    await click(dialog.getByLabel(t.picker.searchLabel).fill(name.toLowerCase()))
    await click(dialog.getByRole('button', { name: new RegExp(name) }).click())
    await expect(card(page, name)).toBeVisible()
    for (let n = 1; n <= 3; n++) {
      if (n > 1) await click(card(page, name).getByRole('button', { name: e.addSet }).click())
      await click(card(page, name).getByLabel(e.fieldOfSet(t.fields.reps, n)).fill('8'))
      await click(card(page, name).getByLabel(e.fieldOfSet(t.fields.weight_kg, n)).fill('60'))
    }
  }
  await expect(page.getByRole('status').first()).toHaveText(t.saveIndicator.saved, {
    timeout: 15_000,
  })
  await click(page.getByRole('button', { name: e.finish }).click())
  await expect(page.getByText(t.status.completed).first()).toBeVisible()
  const fullMs = performance.now() - started2
  const fullInteractions = interactions

  console.log(
    `MEDICION SC-001: empezar con rutina y primera serie = ${Math.round(firstSetMs)} ms (${firstSetInteractions} interacciones, tope 30000 ms); sesion de 3 ejercicios x 3 series = ${Math.round(fullMs)} ms (${fullInteractions} interacciones, tope 240000 ms)`,
  )
  expect(firstSetMs).toBeLessThan(30_000)
  expect(fullMs).toBeLessThan(240_000)
})

test('SC-010: calendario con 200 sesiones, historia con 500 y guardar 30 ejercicios con 20 series', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const email = uniqueEmail('trm')
  await register(page, email)
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  const exerciseId = dbQuery(
    `select id from public.exercises where user_id = ${userOf(email)} and name = 'Press e2e'`,
  )
  const sql = readFileSync(
    '../specs/006-rutinas-calendario-sesiones/mediciones/sinteticos.sql',
    'utf8',
  ).replaceAll('__EMAIL__', email)
  execSync('docker exec -i supabase_db_myguide psql -U postgres -v ON_ERROR_STOP=1', {
    input: sql,
    encoding: 'utf8',
  })
  const counts = dbQuery(
    `select count(*) || ' sesiones, ' || (select count(*) from public.session_exercises where user_id = ${userOf(email)} and exercise_id = '${exerciseId}') || ' del ejercicio' from public.workout_sessions where user_id = ${userOf(email)}`,
  )

  // Calendario del mes, en la interfaz.
  const calendarStart = performance.now()
  await page.goto('/entrenamiento')
  await expect(
    page
      .getByRole('link', { name: /: [2-9]\d* sesiones realizadas|: \d+ sesiones realizadas/ })
      .first(),
  ).toBeVisible()
  const calendarMs = performance.now() - calendarStart

  // Primera tanda de la historia, en la interfaz.
  const historyStart = performance.now()
  await page.goto(`/ejercicios/${exerciseId}/historia`)
  await expect(page.getByRole('link', { name: /Ver la sesión/ }).first()).toBeVisible()
  const historyMs = performance.now() - historyStart

  // Las mismas consultas por la API, con el token real.
  const token = await accessToken(page)
  const month = await rpc(token, 'exercise_history', {
    exercise_id: exerciseId,
    page_size: 10,
    page_offset: 0,
  })
  const apiHistoryMs = month.ms

  // Guardar una sesión de 30 ejercicios con 20 series.
  const start = await rpc(token, 'start_workout', {
    request_id: crypto.randomUUID(),
    client_timezone: 'UTC',
  })
  const sessionId = (start.body as { id: string }).id
  const payload = {
    exercises: Array.from({ length: 30 }, () => ({
      id: crypto.randomUUID(),
      exercise_id: exerciseId,
      plan_item_id: null,
      is_substitute: false,
      effort: 7,
      sets: Array.from({ length: 20 }, () => ({ reps: 8, weight_kg: 60 })),
    })),
  }
  const save = await rpc(token, 'save_workout', {
    id: sessionId,
    payload,
    expected_revision: (start.body as { revision: number }).revision,
    finish: true,
  })

  console.log(
    `MEDICION SC-010 (${counts}): calendario del mes = ${Math.round(calendarMs)} ms (tope 2000 ms); primera tanda de la historia = ${Math.round(historyMs)} ms en la interfaz y ${Math.round(apiHistoryMs)} ms por la API (tope 1000 ms); guardar 30 ejercicios x 20 series = ${Math.round(save.ms)} ms`,
  )
  expect(calendarMs).toBeLessThan(2_000)
  expect(historyMs).toBeLessThan(1_000)
})
