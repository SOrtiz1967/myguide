// T046 (spec 006, escenarios 18 a 27 del quickstart): una sesión desde una rutina, plan frente a lo realizado.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const e = t.editor
const h = t.home
const p = t.plan
const r = t.routines

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const card = (page: Page, name: string) => page.getByRole('article', { name })
const planItem = (page: Page, name: string) => page.getByRole('listitem', { name })
const field = (page: Page, name: string, label: string, n: number) =>
  card(page, name).getByLabel(e.fieldOfSet(label, n))
const indicator = (page: Page) => page.getByRole('status').first()

function seedExercises(email: string) {
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  seedOwnExercise(email, { name: 'Plancha e2e', measurement: 'duration' })
  seedOwnExercise(email, { name: 'Correr e2e', measurement: 'distance_duration' })
  seedOwnExercise(email, { name: 'Flexiones e2e', measurement: 'reps_bodyweight' })
  seedOwnExercise(email, { name: 'Remo e2e', measurement: 'reps_weight' })
}

async function pickExercise(page: Page, search: string, name: string) {
  const dialog = page.getByRole('dialog', { name: t.picker.title })
  await dialog.getByLabel(t.picker.searchLabel).fill(search)
  await dialog.getByRole('button', { name: new RegExp(name) }).click()
  await expect(dialog).toHaveCount(0)
}

async function addRoutineExercise(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: r.addExercise }).click()
  await pickExercise(page, search, name)
  await expect(card(page, name)).toBeVisible()
}

/** La rutina del plan: Press (4 series, 8 repeticiones, 60 kg), Plancha (1 serie, 1:30) y Correr (1 serie, 5,25 km). */
async function createRoutine(page: Page, name: string) {
  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByLabel(r.name).fill(name)
  await addRoutineExercise(page, 'press e2e', 'Press e2e')
  await card(page, 'Press e2e').getByLabel(r.sets).fill('4')
  await card(page, 'Press e2e').getByLabel(r.targetReps).fill('8')
  await card(page, 'Press e2e').getByLabel(r.targetWeight).fill('60')
  await addRoutineExercise(page, 'plancha e2e', 'Plancha e2e')
  await card(page, 'Plancha e2e').getByLabel(r.sets).fill('1')
  await card(page, 'Plancha e2e').getByLabel(r.targetDuration).fill('1:30')
  await addRoutineExercise(page, 'correr e2e', 'Correr e2e')
  await card(page, 'Correr e2e').getByLabel(r.sets).fill('1')
  await card(page, 'Correr e2e').getByLabel(r.targetDistance).fill('5,25')
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function startFromHome(page: Page, routine: string) {
  await page.goto('/entrenamiento')
  await page.getByRole('button', { name: h.startWith(routine) }).click()
  await expect(page).toHaveURL(/\/entrenamiento\/sesion\//)
  await expect(page.getByRole('button', { name: e.finish })).toBeVisible()
}

async function finish(page: Page) {
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })
  await page.getByRole('button', { name: e.finish }).click()
  await expect(page.getByText(t.status.completed).first()).toBeVisible()
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

test('escenarios 18 a 21: empezar desde una rutina, el plan es referencia y hacerlo tal cual no marca', async ({
  page,
}) => {
  const email = uniqueEmail('trp')
  await register(page, email)
  seedExercises(email)
  await createRoutine(page, 'Torso e2e')

  // escenario 18: un solo gesto desde el inicio; el plan se ve completo
  await startFromHome(page, 'Torso e2e')
  await expect(planItem(page, 'Press e2e').getByText(r.setsOf(4))).toBeVisible()
  await expect(
    planItem(page, 'Press e2e').getByText(`${p.reference}: 8 repeticiones · 60 kg`),
  ).toBeVisible()
  await expect(planItem(page, 'Plancha e2e').getByText(p.pending)).toBeVisible()

  // escenario 19: el objetivo no se copia como hecho; no hay ejercicios realizados todavía
  await expect(page.getByRole('article')).toHaveCount(0)
  expect(
    dbQuery(
      `select count(*) from public.session_sets s join public.workout_sessions w on w.id = s.session_id where w.user_id = ${userOf(email)}`,
    ),
  ).toBe('0')

  // escenario 20: hacer cada ejercicio del plan; los valores distintos del objetivo no marcan
  await planItem(page, 'Press e2e').getByRole('button', { name: p.doIt }).click()
  await field(page, 'Press e2e', t.fields.reps, 1).fill('10')
  await field(page, 'Press e2e', t.fields.weight_kg, 1).fill('80')
  for (let n = 2; n <= 4; n++) {
    await card(page, 'Press e2e').getByRole('button', { name: e.addSet }).click()
    await field(page, 'Press e2e', t.fields.reps, n).fill('9')
    await field(page, 'Press e2e', t.fields.weight_kg, n).fill('80')
  }
  await planItem(page, 'Plancha e2e').getByRole('button', { name: p.doIt }).click()
  await field(page, 'Plancha e2e', t.fields.duration_s, 1).fill('2:00')
  await planItem(page, 'Correr e2e').getByRole('button', { name: p.doIt }).click()
  await field(page, 'Correr e2e', t.fields.distance_km, 1).fill('3')
  await field(page, 'Correr e2e', t.fields.duration_s, 1).fill('20:00')
  await expect(card(page, 'Press e2e').getByText(p.tagPlan)).toBeVisible()
  await expect(planItem(page, 'Press e2e').getByText(p.done)).toBeVisible()

  // escenario 21: realizada y sin marca de modificada
  await finish(page)
  await expect(page.getByText(t.marks.modified)).toHaveCount(0)
  expect(
    dbQuery(
      `select status || '|' || modified from public.workout_sessions where user_id = ${userOf(email)}`,
    ),
  ).toBe('completed|false')

  // la rutina cambia después y la sesión conserva su plan
  dbQuery(
    `update public.routine_exercises set sets = 2 where user_id = ${userOf(email)} and exercise_name = 'Press e2e'`,
  )
  await page.reload()
  await expect(planItem(page, 'Press e2e').getByText(r.setsOf(4))).toBeVisible()
})

test('escenarios 22 a 26: sustituir, saltear y agregar marcan la sesión como modificada y se explican', async ({
  page,
}) => {
  const email = uniqueEmail('trp')
  await register(page, email)
  seedExercises(email)
  await createRoutine(page, 'Mixta e2e')
  await startFromHome(page, 'Mixta e2e')

  // hacer Press tal cual, con las 4 series
  await planItem(page, 'Press e2e').getByRole('button', { name: p.doIt }).click()
  await field(page, 'Press e2e', t.fields.reps, 1).fill('8')
  for (let n = 2; n <= 4; n++) {
    await card(page, 'Press e2e').getByRole('button', { name: e.addSet }).click()
    await field(page, 'Press e2e', t.fields.reps, n).fill('8')
  }

  // escenario 22: sustituir Plancha por Flexiones
  await planItem(page, 'Plancha e2e').getByRole('button', { name: p.substitute }).click()
  await pickExercise(page, 'flexiones e2e', 'Flexiones e2e')
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('12')
  await expect(card(page, 'Flexiones e2e').getByText(p.tagInstead('Plancha e2e'))).toBeVisible()
  await expect(
    planItem(page, 'Plancha e2e').getByText(p.substitutedBy('Flexiones e2e')),
  ).toBeVisible()

  // escenario 24: agregar un ejercicio que no estaba en el plan
  await page.getByRole('button', { name: e.addExercise }).click()
  await pickExercise(page, 'remo e2e', 'Remo e2e')
  await field(page, 'Remo e2e', t.fields.reps, 1).fill('10')
  await expect(card(page, 'Remo e2e').getByText(p.tagAdded)).toBeVisible()

  // escenario 23: Correr queda sin hacer; al terminar se muestra como no realizado, sin juicios
  await finish(page)
  await expect(page.getByText(t.marks.modified)).toBeVisible()
  await expect(page.getByText(p.diff.not_done('Correr e2e'))).toBeVisible()
  await expect(page.getByText(p.diff.substituted('Plancha e2e', 'Flexiones e2e'))).toBeVisible()
  await expect(page.getByText(p.diff.added('Remo e2e'))).toBeVisible()
  await expect(planItem(page, 'Correr e2e').getByText(p.notDone)).toBeVisible()
  expect(
    dbQuery(
      `select status || '|' || modified from public.workout_sessions where user_id = ${userOf(email)}`,
    ),
  ).toBe('completed|true')

  // escenario 25: el plan original sigue guardado y separado de lo realizado
  expect(
    dbQuery(
      `select string_agg(exercise_name, ',' order by position) from public.session_plan_items where user_id = ${userOf(email)}`,
    ),
  ).toBe('Press e2e,Plancha e2e,Correr e2e')
})

test('escenario 27: empezar una sesión desde el detalle de la rutina', async ({ page }) => {
  const email = uniqueEmail('trp')
  await register(page, email)
  seedExercises(email)
  await createRoutine(page, 'Detalle e2e')

  await page.getByRole('button', { name: r.startWithThis }).click()
  await expect(page).toHaveURL(/\/entrenamiento\/sesion\//)
  await expect(page.getByText(r.exerciseCount(3))).toHaveCount(0)
  await expect(planItem(page, 'Press e2e')).toBeVisible()
  expect(
    dbQuery(
      `select routine_name || '|' || status from public.workout_sessions where user_id = ${userOf(email)}`,
    ),
  ).toBe('Detalle e2e|in_progress')

  // con una sesión abierta no se puede empezar otra desde la rutina
  await page.goto('/entrenamiento')
  await expect(page.getByRole('button', { name: h.startWith('Detalle e2e') })).toHaveCount(0)
})
