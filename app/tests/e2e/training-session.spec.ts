// T023 (spec 006, escenarios 1 a 9 y 43 a 45 del quickstart): registrar una sesión de entrenamiento.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const e = t.editor
const h = t.home

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const card = (page: Page, name: string) => page.getByRole('article', { name })
const field = (page: Page, name: string, label: string, n: number) =>
  card(page, name).getByLabel(e.fieldOfSet(label, n))
const indicator = (page: Page) => page.getByRole('status').first()

/** Cuatro ejercicios propios, uno por tipo de medición. */
function seedFour(email: string) {
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  seedOwnExercise(email, { name: 'Flexiones e2e', measurement: 'reps_bodyweight' })
  seedOwnExercise(email, { name: 'Plancha e2e', measurement: 'duration' })
  seedOwnExercise(email, { name: 'Correr e2e', measurement: 'distance_duration' })
}

async function addExercise(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: e.addExercise }).click()
  const dialog = page.getByRole('dialog', { name: t.picker.title })
  await dialog.getByLabel(t.picker.searchLabel).fill(search)
  await dialog.getByRole('button', { name: new RegExp(name) }).click()
  await expect(dialog).toHaveCount(0)
  await expect(card(page, name)).toBeVisible()
}

async function startEmpty(page: Page) {
  await page.goto('/entrenamiento')
  await page.getByRole('button', { name: h.startEmpty }).click()
  await expect(page).toHaveURL(/\/entrenamiento\/sesion\//)
  await expect(page.getByRole('button', { name: e.finish })).toBeVisible()
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

test('escenarios 1 a 5: una sesión con un ejercicio de cada tipo, con unidades, datos ausentes y peso 0', async ({
  page,
}) => {
  const email = uniqueEmail('trs')
  await register(page, email)
  seedFour(email)
  await startEmpty(page)

  await addExercise(page, 'press e2e', 'Press e2e')
  await addExercise(page, 'flexiones e2e', 'Flexiones e2e')
  await addExercise(page, 'plancha e2e', 'Plancha e2e')
  await addExercise(page, 'correr e2e', 'Correr e2e')

  // escenario 1: cada tipo pide solo lo que corresponde
  await expect(
    card(page, 'Press e2e').getByLabel(e.fieldOfSet(t.fields.weight_kg, 1)),
  ).toBeVisible()
  await expect(
    card(page, 'Flexiones e2e').getByLabel(e.fieldOfSet(t.fields.weight_kg, 1)),
  ).toHaveCount(0)
  await expect(
    card(page, 'Plancha e2e').getByLabel(e.fieldOfSet(t.fields.duration_s, 1)),
  ).toBeVisible()
  await expect(
    card(page, 'Correr e2e').getByLabel(e.fieldOfSet(t.fields.distance_km, 1)),
  ).toBeVisible()

  // escenarios 2 y 3: una serie sin peso y otra con peso 0
  await field(page, 'Press e2e', t.fields.reps, 1).fill('8')
  await field(page, 'Press e2e', t.fields.weight_kg, 1).fill('62,5')
  await card(page, 'Press e2e').getByRole('button', { name: e.addSet }).click()
  await field(page, 'Press e2e', t.fields.reps, 2).fill('6')
  await card(page, 'Press e2e').getByRole('button', { name: e.addSet }).click()
  await field(page, 'Press e2e', t.fields.reps, 3).fill('5')
  await field(page, 'Press e2e', t.fields.weight_kg, 3).fill('0')

  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('12')
  await field(page, 'Plancha e2e', t.fields.duration_s, 1).fill('1:30')
  await field(page, 'Correr e2e', t.fields.distance_km, 1).fill('5,25')
  await field(page, 'Correr e2e', t.fields.duration_s, 1).fill('30:00')

  // escenario 4: valores fuera de rango
  await field(page, 'Press e2e', t.fields.reps, 1).fill('0')
  await expect(card(page, 'Press e2e').getByText(t.validation.reps)).toBeVisible()
  await expect(page.getByRole('button', { name: e.finish })).toBeDisabled()
  await field(page, 'Press e2e', t.fields.reps, 1).fill('8')
  await expect(page.getByRole('button', { name: e.finish })).toBeEnabled()

  // escenario 5: terminar
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })
  await page.getByRole('button', { name: e.finish }).click()
  await expect(page.getByText(t.status.completed).first()).toBeVisible()
  await expect(page.getByText('8 repeticiones · 62,5 kg')).toBeVisible()
  await expect(page.getByText('6 repeticiones · peso: sin dato')).toBeVisible()
  await expect(page.getByText('5 repeticiones · 0 kg')).toBeVisible()
  await expect(page.getByText('12 repeticiones')).toBeVisible()
  await expect(page.getByText('1:30 min')).toBeVisible()
  await expect(page.getByText('5,25 km · 30:00 min')).toBeVisible()

  expect(
    dbQuery(
      `select status || '|' || (select count(*) from public.session_sets s where s.session_id = w.id) from public.workout_sessions w where w.user_id = ${userOf(email)}`,
    ),
  ).toBe('completed|6')
})

test('escenario 6: registrar un entrenamiento de ayer', async ({ page }) => {
  const email = uniqueEmail('trs')
  await register(page, email)
  seedFour(email)
  await page.goto('/entrenamiento')
  const yesterday = new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() - 86_400_000))
  await page.getByLabel(h.otherDateLabel).fill(yesterday)
  await page.getByRole('button', { name: h.register }).click()
  await expect(page.getByRole('button', { name: e.finish })).toBeVisible()
  await addExercise(page, 'flexiones e2e', 'Flexiones e2e')
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('10')
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })
  await page.getByRole('button', { name: e.finish }).click()
  const [year, month, day] = yesterday.split('-')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`${day}/${month}/${year}`)
  expect(
    dbQuery(
      `select session_date::text from public.workout_sessions where user_id = ${userOf(email)}`,
    ),
  ).toBe(yesterday)
})

test('escenarios 7, 8 y 9: quitar una serie, una sola sesión en curso y el esfuerzo percibido', async ({
  page,
}) => {
  const email = uniqueEmail('trs')
  await register(page, email)
  seedFour(email)
  await startEmpty(page)
  await addExercise(page, 'flexiones e2e', 'Flexiones e2e')
  await addExercise(page, 'plancha e2e', 'Plancha e2e')

  // escenario 7
  const flexiones = card(page, 'Flexiones e2e')
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('10')
  await flexiones.getByRole('button', { name: e.addSet }).click()
  await field(page, 'Flexiones e2e', t.fields.reps, 2).fill('99')
  await flexiones.getByRole('button', { name: e.addSet }).click()
  await field(page, 'Flexiones e2e', t.fields.reps, 3).fill('8')
  await flexiones.getByRole('button', { name: e.removeSet(2) }).click()
  await expect(field(page, 'Flexiones e2e', t.fields.reps, 2)).toHaveValue('8')
  await expect(flexiones.getByLabel(e.fieldOfSet(t.fields.reps, 3))).toHaveCount(0)

  // escenario 9: un esfuerzo para todo el ejercicio, otro sin indicar
  await flexiones.getByLabel(e.effortOfExercise('Flexiones e2e')).selectOption('7')
  await field(page, 'Plancha e2e', t.fields.duration_s, 1).fill('45')

  // escenario 8: con una sesión abierta no se puede empezar otra
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })
  await page.goto('/entrenamiento')
  await expect(page.getByText(h.inProgressTitle)).toBeVisible()
  await expect(page.getByRole('button', { name: h.startEmpty })).toHaveCount(0)
  expect(
    dbQuery(
      `select count(*) from public.workout_sessions where user_id = ${userOf(email)} and status = 'in_progress'`,
    ),
  ).toBe('1')

  await page.getByRole('link', { name: h.continue }).click()
  await expect(field(page, 'Flexiones e2e', t.fields.reps, 1)).toHaveValue('10')
  await page.getByRole('button', { name: e.finish }).click()
  await expect(page.getByText(`${t.session.effort}: ${t.effort.value(7)}`)).toBeVisible()
  await expect(page.getByText(`${t.session.effort}: ${t.noData}`)).toBeVisible()
})

test('escenario 43: recargar a la mitad recupera lo escrito y cerrar sesión borra el borrador', async ({
  page,
}) => {
  const email = uniqueEmail('trs')
  await register(page, email)
  seedFour(email)
  await startEmpty(page)
  await addExercise(page, 'flexiones e2e', 'Flexiones e2e')
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })

  // lo escrito llega al borrador del dispositivo de inmediato, antes del autoguardado
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('15')
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes(':workout-')).length),
    )
    .toBe(1)
  await page.reload()
  await expect(field(page, 'Flexiones e2e', t.fields.reps, 1)).toHaveValue('15')

  // cerrar sesión borra el borrador del dispositivo
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('16')
  await page.getByRole('button', { name: es.auth.actions.logout }).click()
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('draft:')).length),
    )
    .toBe(0)
})

test('escenario 44: sin conexión no se da nada por guardado y al volver se guarda', async ({
  page,
  context,
}) => {
  const email = uniqueEmail('trs')
  await register(page, email)
  seedFour(email)
  await startEmpty(page)
  await addExercise(page, 'flexiones e2e', 'Flexiones e2e')
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })

  await context.setOffline(true)
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('20')
  await expect(indicator(page)).toHaveText(t.saveIndicator.offline, { timeout: 15_000 })
  expect(
    dbQuery(
      `select count(*) from public.session_sets where user_id = ${userOf(email)} and reps = 20`,
    ),
  ).toBe('0')

  await context.setOffline(false)
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 20_000 })
  expect(
    dbQuery(
      `select count(*) from public.session_sets where user_id = ${userOf(email)} and reps = 20`,
    ),
  ).toBe('1')
})

test('escenario 45: la misma sesión en dos pestañas avisa del conflicto y deja elegir', async ({
  page,
  context,
}) => {
  const email = uniqueEmail('trs')
  await register(page, email)
  seedFour(email)
  await startEmpty(page)
  await addExercise(page, 'flexiones e2e', 'Flexiones e2e')
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })

  const other = await context.newPage()
  await other.goto(page.url())
  await expect(card(other, 'Flexiones e2e')).toBeVisible()

  // la primera pestaña guarda un cambio
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('11')
  await expect(indicator(page)).toHaveText(t.saveIndicator.saved, { timeout: 15_000 })

  // la segunda, que quedó con la revisión anterior, escribe otra cosa
  // la serie vacía no se guarda: al abrir la sesión de nuevo, el ejercicio no trae series
  await card(other, 'Flexiones e2e').getByRole('button', { name: e.addSet }).click()
  await field(other, 'Flexiones e2e', t.fields.reps, 1).fill('22')
  await expect(other.getByText(e.conflictTitle)).toBeVisible({ timeout: 15_000 })
  expect(
    dbQuery(
      `select count(*) from public.session_sets where user_id = ${userOf(email)} and reps = 22`,
    ),
  ).toBe('0')

  // conservar la de este dispositivo guarda lo de la segunda pestaña
  await other.getByRole('button', { name: e.keepMine }).click()
  await expect(other.getByText(e.conflictTitle)).toHaveCount(0)
  await expect(indicator(other)).toHaveText(t.saveIndicator.saved, { timeout: 20_000 })
  expect(
    dbQuery(
      `select string_agg(reps::text, ',') from public.session_sets where user_id = ${userOf(email)}`,
    ),
  ).toBe('22')

  // la primera, ahora vieja, elige la del servidor y adopta lo guardado
  await field(page, 'Flexiones e2e', t.fields.reps, 1).fill('33')
  await expect(page.getByText(e.conflictTitle)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: e.useServer }).click()
  await expect(field(page, 'Flexiones e2e', t.fields.reps, 1)).toHaveValue('22')
})
