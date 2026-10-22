// T065 (spec 006, escenarios 37 a 39 del quickstart): la historia de un ejercicio y «la última vez».
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const h = t.history
const e = t.editor

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const card = (page: Page, name: string) => page.getByRole('article', { name })
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))

/** Tres sesiones realizadas con el press: 60, 65 y 70 kg. */
function seedHistory(email: string) {
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  seedOwnExercise(email, { name: 'Plancha e2e', measurement: 'duration' })
  const exerciseId = dbQuery(
    `select id from public.exercises where user_id = ${userOf(email)} and name = 'Press e2e'`,
  )
  const sessions: string[] = []
  ;[
    [-14, 60],
    [-7, 65],
    [-1, 70],
  ].forEach(([offset, weight]) => {
    const sessionId = dbQuery(
      `select tests.create_session(${userOf(email)}, date '${day(offset!)}', 'completed')`,
    )
    const x = dbQuery(`select tests.add_session_exercise('${sessionId}', '${exerciseId}')`)
    dbQuery(`select tests.add_session_set('${x}', 8, ${weight})`)
    sessions.push(sessionId)
  })
  return { exerciseId, sessions }
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

test('escenario 37: la historia de un ejercicio, de la más reciente a la más antigua', async ({
  page,
}) => {
  const email = uniqueEmail('trh')
  await register(page, email)
  const { exerciseId } = seedHistory(email)

  // se llega desde el detalle del ejercicio
  await page.goto(`/ejercicios/${exerciseId}`)
  await page.getByRole('link', { name: h.view }).click()
  await expect(page.getByRole('heading', { level: 1, name: h.title })).toBeVisible()

  await expect(page.getByText('8 repeticiones · 70 kg')).toBeVisible()
  const rows = await page.locator('p.font-medium').allTextContents()
  expect(rows.map((row) => row.slice(0, 10))).toEqual(
    [-1, -7, -14].map((offset) => {
      const [year, month, d] = day(offset).split('-')
      return `${d}/${month}/${year}`
    }),
  )
  await expect(page.getByText('8 repeticiones · 60 kg')).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver la sesión/ })).toHaveCount(3)
  // sin gráficos, metas ni recomendaciones
  await expect(page.getByRole('img')).toHaveCount(0)
})

test('escenario 38: «la última vez» dentro de una sesión, sin salir de ella', async ({ page }) => {
  const email = uniqueEmail('trh')
  await register(page, email)
  seedHistory(email)

  await page.goto('/entrenamiento')
  await page.getByRole('button', { name: t.home.startEmpty }).click()
  await expect(page.getByRole('button', { name: e.finish })).toBeVisible()
  const url = page.url()
  for (const [search, name] of [
    ['press e2e', 'Press e2e'],
    ['plancha e2e', 'Plancha e2e'],
  ] as const) {
    await page.getByRole('button', { name: e.addExercise }).click()
    const dialog = page.getByRole('dialog', { name: t.picker.title })
    await dialog.getByLabel(t.picker.searchLabel).fill(search)
    await dialog.getByRole('button', { name: new RegExp(name) }).click()
    await expect(card(page, name)).toBeVisible()
  }

  await card(page, 'Press e2e').getByRole('button', { name: h.lastTime }).click()
  await expect(card(page, 'Press e2e').getByText('8 repeticiones · 70 kg')).toBeVisible()
  expect(page.url()).toBe(url)

  // un ejercicio sin historia lo dice, sin inventar datos
  await card(page, 'Plancha e2e').getByRole('button', { name: h.lastTime }).click()
  await expect(card(page, 'Plancha e2e').getByText(h.empty)).toBeVisible()
})

test('escenario 39: renombrar o eliminar el ejercicio no cambia lo registrado', async ({
  page,
}) => {
  const email = uniqueEmail('trh')
  await register(page, email)
  const { exerciseId, sessions } = seedHistory(email)

  dbQuery(`update public.exercises set name = 'Press renombrado e2e' where id = '${exerciseId}'`)
  await page.goto(`/ejercicios/${exerciseId}/historia`)
  await expect(page.getByText(/ · Press e2e$/).first()).toBeVisible()
  await expect(page.getByText(/Press renombrado e2e/, { selector: 'p.break-words' })).toBeVisible()

  dbQuery(`delete from public.exercises where id = '${exerciseId}'`)
  await page.goto(`/entrenamiento/sesion/${sessions[0]}`)
  await expect(page.getByText(t.status.completed).first()).toBeVisible()
  await expect(page.getByText('Press e2e').first()).toBeVisible()

  await page.goto(`/ejercicios/${exerciseId}/historia`)
  await expect(page.getByText(h.empty)).toBeVisible()
})
