// T071 (spec 006, escenarios 40 a 42 del quickstart): corregir y eliminar una sesión; lo registrado no cambia con el catálogo.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { formatDate } from '../../src/lib/format'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const s = t.session
const e = t.editor

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))
const field = (page: Page, name: string, label: string, n: number) =>
  page.getByRole('article', { name }).getByLabel(e.fieldOfSet(label, n))

function seedSession(email: string) {
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  const exerciseId = dbQuery(
    `select id from public.exercises where user_id = ${userOf(email)} and name = 'Press e2e'`,
  )
  const sessionId = dbQuery(
    `select tests.create_session(${userOf(email)}, date '${day(-1)}', 'completed')`,
  )
  const x = dbQuery(`select tests.add_session_exercise('${sessionId}', '${exerciseId}')`)
  dbQuery(`select tests.add_session_set('${x}', 8, 60)`)
  return { exerciseId, sessionId }
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

test('escenario 40: corregir una serie de una sesión realizada', async ({ page }) => {
  const email = uniqueEmail('trx')
  await register(page, email)
  const { sessionId } = seedSession(email)

  await page.goto(`/entrenamiento/sesion/${sessionId}`)
  await expect(page.getByText('8 repeticiones · 60 kg')).toBeVisible()
  await page.getByRole('button', { name: s.correct }).click()
  await expect(page.getByText(s.correcting)).toBeVisible()
  await field(page, 'Press e2e', t.fields.reps, 1).fill('10')
  await expect(page.getByRole('status').first()).toHaveText(t.saveIndicator.saved, {
    timeout: 15_000,
  })
  await page.getByRole('button', { name: s.finishCorrection }).click()

  await expect(page.getByText('10 repeticiones · 60 kg')).toBeVisible()
  await expect(page.getByText(t.marks.corrected).first()).toBeVisible()
  await expect(page.getByText(s.correctedOn(formatDate(day(0))))).toBeVisible()
  expect(
    dbQuery(
      `select status || '|' || (corrected_at is not null) || '|' || (select exercise_name || ':' || measurement_type from public.session_exercises where session_id = w.id) from public.workout_sessions w where w.id = '${sessionId}'`,
    ),
  ).toBe('completed|true|Press e2e:reps_weight')
})

test('escenario 41: eliminar una sesión con confirmación; desaparece del calendario y de la historia', async ({
  page,
}) => {
  const email = uniqueEmail('trx')
  await register(page, email)
  const { sessionId, exerciseId } = seedSession(email)

  await page.goto(`/entrenamiento/sesion/${sessionId}`)
  await page.getByRole('button', { name: s.delete }).click()
  await expect(page.getByRole('dialog', { name: s.confirmDeleteTitle })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(dbQuery(`select count(*) from public.workout_sessions where id = '${sessionId}'`)).toBe(
    '1',
  )

  await page.getByRole('button', { name: s.delete }).click()
  await page.getByRole('button', { name: s.confirmDelete }).click()
  await expect(page.getByText(s.deleted)).toBeVisible()
  await expect(page).toHaveURL(/\/entrenamiento$/)
  await expect(
    page.getByRole('link', { name: new RegExp(`: sin sesiones$`) }).first(),
  ).toBeVisible()
  expect(
    dbQuery(`select count(*) from public.workout_sessions where user_id = ${userOf(email)}`),
  ).toBe('0')

  await page.goto(`/ejercicios/${exerciseId}/historia`)
  await expect(page.getByText(t.history.empty)).toBeVisible()
})

test('escenario 42: editar o eliminar un ejercicio y repetir la importación no cambia las sesiones', async ({
  page,
}) => {
  const email = uniqueEmail('trx')
  await register(page, email)
  const { exerciseId, sessionId } = seedSession(email)
  const catalogId = dbQuery(
    `select tests.create_catalog_exercise('free-exercise-db', 'E2E-42', 'Remo del catalogo e2e', 'reps_weight')`,
  )
  const x = dbQuery(`select tests.add_session_exercise('${sessionId}', '${catalogId}')`)
  dbQuery(`select tests.add_session_set('${x}', 12, 40)`)

  // editar el ejercicio propio, cambiar su tipo y repetir la importación del catálogo
  dbQuery(`update public.exercises set name = 'Press cambiado e2e' where id = '${exerciseId}'`)
  dbQuery(`update public.exercises set measurement_type = 'duration' where id = '${exerciseId}'`)
  dbQuery(`update public.exercises set name = 'Remo reimportado e2e' where id = '${catalogId}'`)
  await page.goto(`/entrenamiento/sesion/${sessionId}`)
  await expect(page.getByText('Press e2e')).toBeVisible()
  await expect(page.getByText('Remo del catalogo e2e')).toBeVisible()
  await expect(page.getByText('8 repeticiones · 60 kg')).toBeVisible()

  // eliminar el ejercicio propio
  dbQuery(`delete from public.exercises where id = '${exerciseId}'`)
  await page.reload()
  await expect(page.getByText('Press e2e')).toBeVisible()
  await expect(page.getByText('8 repeticiones · 60 kg')).toBeVisible()
  expect(
    dbQuery(
      `select string_agg(exercise_name || ':' || measurement_type, ',' order by position) from public.session_exercises where session_id = '${sessionId}'`,
    ),
  ).toBe('Press e2e:reps_weight,Remo del catalogo e2e:reps_weight')
})
