// T035 (spec 006, escenarios 10 a 17 del quickstart): armar y mantener rutinas.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const r = t.routines
const re = t.errors.routine

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const card = (page: Page, name: string) => page.getByRole('article', { name })

function seedThree(email: string) {
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  seedOwnExercise(email, { name: 'Plancha e2e', measurement: 'duration' })
  seedOwnExercise(email, { name: 'Correr e2e', measurement: 'distance_duration' })
}

async function addExercise(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: r.addExercise }).click()
  const dialog = page.getByRole('dialog', { name: t.picker.title })
  await dialog.getByLabel(t.picker.searchLabel).fill(search)
  await dialog.getByRole('button', { name: new RegExp(name) }).click()
  await expect(dialog).toHaveCount(0)
  await expect(card(page, name)).toBeVisible()
}

async function createRoutine(page: Page, name: string) {
  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByLabel(r.name).fill(name)
  await addExercise(page, 'press e2e', 'Press e2e')
  await card(page, 'Press e2e').getByLabel(r.sets).fill('4')
  await card(page, 'Press e2e').getByLabel(r.targetReps).fill('8')
  await card(page, 'Press e2e').getByLabel(r.targetWeight).fill('60')
  await addExercise(page, 'plancha e2e', 'Plancha e2e')
  await card(page, 'Plancha e2e').getByLabel(r.targetDuration).fill('1:30')
  await addExercise(page, 'correr e2e', 'Correr e2e')
  await card(page, 'Correr e2e').getByLabel(r.targetDistance).fill('5,25')
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
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

test('escenarios 10 a 12: crear una rutina con objetivos por tipo y validaciones', async ({
  page,
}) => {
  const email = uniqueEmail('trr')
  await register(page, email)
  seedThree(email)

  // escenario 12: sin nombre ni ejercicios
  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByText(re.name_required)).toBeVisible()
  await expect(page.getByText(re.exercises_required)).toBeVisible()

  // escenarios 10 y 11
  await createRoutine(page, 'Torso A e2e')
  await expect(page.getByText(r.saved)).toBeVisible()
  await expect(card(page, 'Press e2e').getByText('8 repeticiones · 60 kg')).toBeVisible()
  await expect(card(page, 'Press e2e').getByText(r.setsOf(4))).toBeVisible()
  await expect(card(page, 'Plancha e2e').getByText('1:30 min')).toBeVisible()
  await expect(card(page, 'Correr e2e').getByText('5,25 km')).toBeVisible()
  expect(
    dbQuery(
      `select string_agg(position || ':' || exercise_name, ',' order by position) from public.routine_exercises where user_id = ${userOf(email)}`,
    ),
  ).toBe('1:Press e2e,2:Plancha e2e,3:Correr e2e')

  // escenario 12: series fuera de rango
  await page.getByRole('link', { name: r.edit }).click()
  await card(page, 'Press e2e').getByLabel(r.sets).fill('21')
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByText(re.invalid_sets)).toBeVisible()
})

test('escenarios 13 y 14: editar el orden y un objetivo, duplicar y eliminar la copia', async ({
  page,
}) => {
  const email = uniqueEmail('trr')
  await register(page, email)
  seedThree(email)
  await createRoutine(page, 'Para editar e2e')

  // editar: orden y un objetivo
  await page.getByRole('link', { name: r.edit }).click()
  await page.getByRole('button', { name: t.editor.moveExerciseUp('Correr e2e') }).click()
  await card(page, 'Press e2e').getByLabel(r.targetWeight).fill('62,5')
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByText(r.saved)).toBeVisible()
  await expect(card(page, 'Press e2e').getByText('8 repeticiones · 62,5 kg')).toBeVisible()
  expect(
    dbQuery(
      `select string_agg(exercise_name, ',' order by position) from public.routine_exercises where user_id = ${userOf(email)}`,
    ),
  ).toBe('Press e2e,Correr e2e,Plancha e2e')

  // duplicar: una copia independiente
  await page.getByRole('button', { name: r.duplicate }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Para editar e2e (copia)' }),
  ).toBeVisible()
  await expect(page.getByText(r.duplicated)).toBeVisible()
  expect(dbQuery(`select count(*) from public.routines where user_id = ${userOf(email)}`)).toBe('2')

  // eliminar la copia: la original queda intacta
  await page.getByRole('button', { name: r.delete }).click()
  const dialog = page.getByRole('dialog', { name: r.confirmDeleteTitle })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: r.delete }).click()
  await page.getByRole('button', { name: r.confirmDelete }).click()
  await expect(page.getByText(r.deleted)).toBeVisible()
  await expect(page.getByRole('link', { name: /^Para editar e2e(?! (copia))/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /\(copia\)/ })).toHaveCount(0)
  expect(dbQuery(`select name from public.routines where user_id = ${userOf(email)}`)).toBe(
    'Para editar e2e',
  )
})

test('escenario 15: eliminar una rutina no cambia las sesiones ya creadas con ella', async ({
  page,
}) => {
  const email = uniqueEmail('trr')
  await register(page, email)
  seedThree(email)
  await createRoutine(page, 'Con sesion e2e')
  const routineId = dbQuery(`select id from public.routines where user_id = ${userOf(email)}`)
  const sessionId = dbQuery(
    `select tests.create_session(${userOf(email)}, current_date, 'completed', '${routineId}', true)`,
  )

  await page.getByRole('button', { name: r.delete }).click()
  await page.getByRole('button', { name: r.confirmDelete }).click()
  await expect(page.getByText(r.deleted)).toBeVisible()

  expect(dbQuery(`select count(*) from public.routines where id = '${routineId}'`)).toBe('0')
  expect(
    dbQuery(
      `select coalesce(routine_id::text, 'sin rutina') || '|' || routine_name || '|' || (select count(*) from public.session_plan_items p where p.session_id = w.id) from public.workout_sessions w where w.id = '${sessionId}'`,
    ),
  ).toBe('sin rutina|Con sesion e2e|3')
})

test('escenario 16: un ejercicio propio eliminado se avisa y se puede reemplazar', async ({
  page,
}) => {
  const email = uniqueEmail('trr')
  await register(page, email)
  seedThree(email)
  seedOwnExercise(email, { name: 'Remo e2e', measurement: 'reps_weight' })
  await createRoutine(page, 'Con faltante e2e')
  dbQuery(`delete from public.exercises where name = 'Press e2e' and user_id = ${userOf(email)}`)

  // el detalle sigue mostrando el nombre guardado y avisa
  await page.reload()
  await expect(card(page, 'Press e2e').getByText(r.missingExercise)).toBeVisible()

  // en la edición se puede reemplazar
  await page.getByRole('link', { name: r.edit }).click()
  await expect(card(page, 'Press e2e').getByText(r.missingExercise)).toBeVisible()
  await card(page, 'Press e2e').getByRole('button', { name: r.replace }).click()
  const dialog = page.getByRole('dialog', { name: t.picker.title })
  await dialog.getByLabel(t.picker.searchLabel).fill('remo e2e')
  await dialog.getByRole('button', { name: /Remo e2e/ }).click()
  await expect(card(page, 'Remo e2e')).toBeVisible()
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Con faltante e2e' })).toBeVisible()
  await expect(card(page, 'Remo e2e').getByText(r.setsOf(4))).toBeVisible()
  await expect(card(page, 'Remo e2e').getByText(r.missingExercise)).toHaveCount(0)
})

test('escenario 17: doble clic en guardar y corte de red', async ({ page, context }) => {
  const email = uniqueEmail('trr')
  await register(page, email)
  seedThree(email)

  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByLabel(r.name).fill('Doble clic e2e')
  await addExercise(page, 'press e2e', 'Press e2e')
  await page.getByRole('button', { name: r.save }).dblclick()
  await expect(page.getByRole('heading', { level: 1, name: 'Doble clic e2e' })).toBeVisible()
  expect(dbQuery(`select count(*) from public.routines where user_id = ${userOf(email)}`)).toBe('1')

  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByLabel(r.name).fill('Sin red e2e')
  await addExercise(page, 'plancha e2e', 'Plancha e2e')
  await context.setOffline(true)
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByRole('alert').filter({ hasText: r.notSaved })).toBeVisible()
  await expect(page.getByLabel(r.name)).toHaveValue('Sin red e2e')
  expect(dbQuery(`select count(*) from public.routines where user_id = ${userOf(email)}`)).toBe('1')

  await context.setOffline(false)
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sin red e2e' })).toBeVisible()
  expect(dbQuery(`select count(*) from public.routines where user_id = ${userOf(email)}`)).toBe('2')
})
