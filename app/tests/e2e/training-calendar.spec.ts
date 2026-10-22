// T056 (spec 006, escenarios 28 a 36 del quickstart): planificar en el calendario, reprogramar, cancelar y registrar.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { formatDate } from '../../src/lib/format'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const p = t.planning
const r = t.routines

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const card = (page: Page, name: string) => page.getByRole('article', { name })
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))

async function createRoutine(page: Page, name: string, exercise: string) {
  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByLabel(r.name).fill(name)
  await page.getByRole('button', { name: r.addExercise }).click()
  const dialog = page.getByRole('dialog', { name: t.picker.title })
  await dialog.getByLabel(t.picker.searchLabel).fill(exercise.toLowerCase())
  await dialog.getByRole('button', { name: new RegExp(exercise) }).click()
  await expect(card(page, exercise)).toBeVisible()
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function setup(page: Page) {
  const email = uniqueEmail('trc')
  await register(page, email)
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  seedOwnExercise(email, { name: 'Sentadilla e2e', measurement: 'reps_weight' })
  await createRoutine(page, 'Torso e2e', 'Press e2e')
  await createRoutine(page, 'Pierna e2e', 'Sentadilla e2e')
  return email
}

const sessionsOf = (email: string) =>
  dbQuery(
    `select coalesce(string_agg(session_date || ':' || status || ':' || coalesce(routine_name, '-'), ' | ' order by session_date, created_at), '') from public.workout_sessions where user_id = ${userOf(email)}`,
  )

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

test('escenarios 28, 30 y 35: planificar días, cambiar y quitar la rutina, sin duplicados', async ({
  page,
}) => {
  const email = await setup(page)
  const d3 = day(3)

  await page.goto(`/entrenamiento/dia/${d3}`)
  await expect(page.getByText(p.noSessions)).toBeVisible()
  const plan = page.getByRole('button', { name: new RegExp(p.planWith('Torso e2e')) })
  await plan.dblclick()
  await expect(page.getByText(p.planned)).toBeVisible()
  expect(sessionsOf(email)).toBe(`${d3}:planned:Torso e2e`)

  // cambiar la rutina desde la sesión, sin tocar otros días
  await page.getByRole('link', { name: /Planificada/ }).click()
  await page.getByRole('button', { name: p.changeRoutine }).click()
  await page.getByRole('button', { name: p.useRoutine('Pierna e2e') }).click()
  await expect(page.getByText(p.routineChanged)).toBeVisible()
  await expect(page.getByText(t.plan.fromRoutine('Pierna e2e'))).toBeVisible()
  expect(sessionsOf(email)).toBe(`${d3}:planned:Pierna e2e`)

  // quitar el plan: queda una sesión vacía
  await page.getByRole('button', { name: p.changeRoutine }).click()
  await page.getByRole('button', { name: p.removeRoutine }).click()
  await expect(page.getByText(t.noPlan)).toBeVisible()
  expect(
    dbQuery(`select has_plan from public.workout_sessions where user_id = ${userOf(email)}`),
  ).toBe('f')

  // la misma rutina en varios días: sesiones independientes
  for (const offset of [5, 6]) {
    await page.goto(`/entrenamiento/dia/${day(offset)}`)
    await page.getByRole('button', { name: new RegExp(p.planWith('Torso e2e')) }).click()
    await expect(page.getByText(p.planned)).toBeVisible()
  }
  expect(
    dbQuery(
      `select count(*) from public.workout_sessions where user_id = ${userOf(email)} and routine_name = 'Torso e2e'`,
    ),
  ).toBe('2')
})

test('escenarios 31 a 33: reprogramar dos veces, no mover lo realizado, cancelar y volver a planificar', async ({
  page,
}) => {
  const email = await setup(page)
  const d3 = day(3)
  const routineId = dbQuery(
    `select id from public.routines where user_id = ${userOf(email)} and name = 'Torso e2e'`,
  )
  const sessionId = dbQuery(
    `select tests.create_session(${userOf(email)}, date '${d3}', 'planned', '${routineId}', true)`,
  )

  // escenario 31: dos movimientos, siempre la misma sesión
  await page.goto(`/entrenamiento/sesion/${sessionId}`)
  for (const target of [day(5), day(7)]) {
    await page.getByRole('button', { name: p.reschedule }).click()
    await page.getByLabel(p.newDate).fill(target)
    await page.getByRole('button', { name: p.moveDate }).click()
    await expect(page.getByText(p.moved)).toBeVisible()
  }
  await expect(page.getByText(t.marks.rescheduled)).toBeVisible()
  await expect(page.getByText(p.pathStep(formatDate(d3), formatDate(day(5))))).toBeVisible()
  await expect(page.getByText(p.pathStep(formatDate(day(5)), formatDate(day(7))))).toBeVisible()
  expect(sessionsOf(email)).toBe(`${day(7)}:planned:Torso e2e`)

  // escenario 32: una fecha pasada no se acepta
  await page.getByRole('button', { name: p.reschedule }).click()
  await page.getByLabel(p.newDate).fill(day(-1))
  await page.getByRole('button', { name: p.moveDate }).click()
  await expect(page.getByText(p.pastDate)).toBeVisible()
  expect(sessionsOf(email)).toBe(`${day(7)}:planned:Torso e2e`)
  await page.getByRole('button', { name: p.close, exact: true }).click()

  // escenario 33: cancelar conserva el plan y se puede volver a planificar
  await page.getByRole('button', { name: p.cancel }).click()
  await expect(page.getByText(p.cancelled)).toBeVisible()
  await expect(page.getByText(t.status.cancelled).first()).toBeVisible()
  expect(
    dbQuery(`select count(*) from public.session_plan_items where session_id = '${sessionId}'`),
  ).toBe('1')
  await page.getByRole('button', { name: p.replan }).click()
  await page.getByLabel(p.newDate).fill(day(9))
  await page.getByRole('button', { name: p.moveDate }).click()
  await expect(page.getByText(p.moved)).toBeVisible()
  expect(sessionsOf(email)).toBe(`${day(9)}:planned:Torso e2e`)

  // escenario 32: una realizada no ofrece mover ni cancelar
  const doneId = dbQuery(
    `select tests.create_session(${userOf(email)}, date '${day(-2)}', 'completed')`,
  )
  await page.goto(`/entrenamiento/sesion/${doneId}`)
  await expect(page.getByText(t.status.completed).first()).toBeVisible()
  await expect(page.getByRole('button', { name: p.reschedule })).toHaveCount(0)
  await expect(page.getByRole('button', { name: p.cancel })).toHaveCount(0)
})

test('escenarios 34 y 36: planificada vencida («Sin registrar») y un calendario con dos sesiones en un día', async ({
  page,
}) => {
  const email = await setup(page)
  const past = day(-2)
  const routineId = dbQuery(
    `select id from public.routines where user_id = ${userOf(email)} and name = 'Torso e2e'`,
  )
  dbQuery(
    `select tests.create_session(${userOf(email)}, date '${past}', 'planned', '${routineId}', true)`,
  )
  dbQuery(
    `select tests.create_session(${userOf(email)}, date '${day(0)}', 'completed', '${routineId}', true)`,
  )
  dbQuery(`select tests.create_session(${userOf(email)}, date '${day(0)}', 'planned')`)

  // escenario 36: el calendario del mes con estados dichos con palabras
  await page.goto('/entrenamiento')
  await expect(
    page.getByRole('link', { name: /: 1 sesión realizada, 1 planificada$/ }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /: 1 sin registrar$/ }).first()).toBeVisible()

  // escenario 34: «Sin registrar» con sus tres acciones; registrar pregunta qué día la hizo
  const due = page.getByRole('region', { name: t.home.dueTitle })
  await expect(due.getByText(new RegExp(t.overdue)).first()).toBeVisible()
  await due.getByRole('button', { name: p.registerAction }).first().click()
  await expect(page.getByRole('textbox', { name: p.whichDay })).toHaveValue(day(0))
  await page.getByRole('textbox', { name: p.whichDay }).fill(past)
  await page.getByRole('button', { name: p.confirmStart }).click()
  await expect(page).toHaveURL(/\/entrenamiento\/sesion\//)
  await expect(page.getByRole('button', { name: es.training.editor.finish })).toBeVisible()
  expect(
    dbQuery(
      `select session_date || '|' || original_date || '|' || rescheduled_count || '|' || status from public.workout_sessions where user_id = ${userOf(email)} and status = 'in_progress'`,
    ),
  ).toBe(`${past}|${past}|0|in_progress`)
})
