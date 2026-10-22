// T073 (spec 006, escenario 47, FR-052, SC-012): accesibilidad de las pantallas de entrenamiento (axe) y teclado.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const e = t.editor
const r = t.routines

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    ),
    `Violaciones de accesibilidad en ${name}`,
  ).toEqual([])
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

test('axe: inicio con calendario, día, sesión en sus cuatro estados, editor, rutinas e historia', async ({
  page,
}) => {
  const email = uniqueEmail('tra')
  await register(page, email)
  const user = userOf(email)
  seedOwnExercise(email, { name: 'Press e2e', measurement: 'reps_weight' })
  const exerciseId = dbQuery(
    `select id from public.exercises where user_id = ${user} and name = 'Press e2e'`,
  )
  const routineId = dbQuery(
    `select tests.create_routine(${user}, 'Torso e2e', array['${exerciseId}'::uuid], 3)`,
  )
  const planned = dbQuery(
    `select tests.create_session(${user}, date '${day(3)}', 'planned', '${routineId}', true)`,
  )
  const cancelled = dbQuery(
    `select tests.create_session(${user}, date '${day(4)}', 'cancelled', '${routineId}', true)`,
  )
  const done = dbQuery(
    `select tests.create_session(${user}, date '${day(-1)}', 'completed', '${routineId}', true)`,
  )
  const x = dbQuery(`select tests.add_session_exercise('${done}', '${exerciseId}')`)
  dbQuery(`select tests.add_session_set('${x}', 8, 60)`)
  dbQuery(
    `select tests.create_session(${user}, date '${day(-3)}', 'planned', '${routineId}', true)`,
  )

  // inicio con el calendario, un día y la sesión en sus estados
  await page.goto('/entrenamiento')
  await expect(page.getByRole('link', { name: /: 1 sesión realizada$/ })).toBeVisible()
  await expectNoViolations(page, '/entrenamiento')
  await page.goto(`/entrenamiento/dia/${day(3)}`)
  await expect(page.getByRole('button', { name: t.planning.reschedule })).toBeVisible()
  await expectNoViolations(page, 'un día')
  await page.getByRole('button', { name: t.planning.reschedule }).click()
  await expectNoViolations(page, 'reprogramar')
  for (const [id, label] of [
    [planned, 'planificada'],
    [cancelled, 'cancelada'],
    [done, 'realizada'],
  ] as const) {
    await page.goto(`/entrenamiento/sesion/${id}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoViolations(page, `sesión ${label}`)
  }
  await page.getByRole('button', { name: t.session.delete }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoViolations(page, 'diálogo de eliminar sesión')
  await page.keyboard.press('Escape')

  // editor, con errores y con el panel de agregar ejercicio abierto
  await page.goto('/entrenamiento')
  await page.getByRole('button', { name: t.home.startWith('Torso e2e') }).click()
  await expect(page.getByRole('button', { name: e.finish })).toBeVisible()
  await page.getByRole('button', { name: t.plan.doIt }).click()
  await page.getByLabel(e.fieldOfSet(t.fields.reps, 1)).fill('0')
  await expect(page.getByText(t.validation.reps)).toBeVisible()
  await expectNoViolations(page, 'editor con errores')
  await page.getByRole('button', { name: e.addExercise }).click()
  await expect(page.getByRole('dialog', { name: t.picker.title })).toBeVisible()
  await expectNoViolations(page, 'panel de agregar ejercicio')
  await page.keyboard.press('Escape')

  // rutinas
  await page.goto('/entrenamiento/rutinas')
  await expect(page.getByRole('link', { name: /Torso e2e/ })).toBeVisible()
  await expectNoViolations(page, 'lista de rutinas')
  await page.goto(`/entrenamiento/rutinas/${routineId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Torso e2e' })).toBeVisible()
  await expectNoViolations(page, 'detalle de rutina')
  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByText(t.errors.routine.name_required)).toBeVisible()
  await expectNoViolations(page, 'formulario de rutina con errores')

  // historia
  await page.goto(`/ejercicios/${exerciseId}/historia`)
  await expect(page.getByRole('heading', { level: 1, name: t.history.title })).toBeVisible()
  await expectNoViolations(page, 'historia de un ejercicio')
})

test('teclado: el calendario se recorre con Tab y el diálogo de eliminar devuelve el foco', async ({
  page,
}) => {
  const email = uniqueEmail('tra')
  await register(page, email)
  const user = userOf(email)
  const done = dbQuery(`select tests.create_session(${user}, date '${day(-1)}', 'completed')`)

  await page.goto('/entrenamiento')
  const dayLink = page.getByRole('link', { name: /: 1 sesión realizada$/ })
  await expect(dayLink).toBeVisible()
  await dayLink.focus()
  await expect(dayLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/entrenamiento/dia/${day(-1)}$`))

  await page.goto(`/entrenamiento/sesion/${done}`)
  const open = page.getByRole('button', { name: t.session.delete })
  await open.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: t.session.cancelDelete })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(open).toBeFocused()
})
