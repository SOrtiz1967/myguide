// T031 (spec 005, escenarios 15 a 22 del quickstart): crear un ejercicio propio.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, ownExercises, seedOwnExercise } from './exercises-support'
import { login, PASSWORD, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.exercises
const f = t.form

async function registerUser(page: Page) {
  const email = uniqueEmail('exc')
  await register(page, email)
  return email
}

const nameField = (page: Page) => page.getByLabel(f.name, { exact: true })
const measurement = (page: Page, label: string) =>
  page.getByRole('radio', { name: new RegExp(`^${label}`) })
const saveButton = (page: Page) => page.getByRole('button', { name: t.actions.save })
const section = (page: Page, title: string) =>
  page.getByRole('heading', { name: title }).locator('xpath=ancestor::section[1]')

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

test('escenario 15: con solo nombre y tipo de medición se guarda y el resto dice «sin dato»', async ({
  page,
}) => {
  const email = await registerUser(page)
  await page.goto('/ejercicios/nuevo')
  await nameField(page).fill('Plancha lateral propia e2e')
  await measurement(page, 'Tiempo').check()
  await saveButton(page).click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Plancha lateral propia e2e' }),
  ).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: f.saved })).toBeVisible()
  await expect(section(page, t.detail.equipment)).toContainText(t.missing)
  await expect(section(page, t.detail.primaryMuscles)).toContainText(t.missing)
  await expect(section(page, t.detail.description)).toContainText(t.missing)
  await expect(section(page, t.provenance.title)).toContainText('Propio')
  expect(ownExercises(email)).toEqual(['Plancha lateral propia e2e|duration'])
})

test('escenario 16: completo, y se encuentra por nombre y por «otro nombre», marcado «Propio»', async ({
  page,
}) => {
  const email = await registerUser(page)
  await page.goto('/ejercicios/nuevo')
  await nameField(page).fill('Remo con banda propio e2e')
  await measurement(page, 'Repeticiones y peso').check()
  await page.getByRole('group', { name: f.primaryLegend }).getByLabel('Dorsales').check()
  await page.getByRole('group', { name: f.primaryLegend }).getByLabel('Espalda media').check()
  await page.getByRole('group', { name: f.secondaryLegend }).getByLabel('Bíceps').check()
  await page.getByLabel(f.equipment).selectOption('bands')
  await page
    .getByLabel(f.description, { exact: false })
    .fill('1. Sujeta la banda.\n2. Tira hacia el abdomen.')
  await page.getByLabel(f.aliases, { exact: false }).fill('Remo elástico e2e, Remo con goma e2e')
  await saveButton(page).click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Remo con banda propio e2e' }),
  ).toBeVisible()
  await expect(section(page, t.detail.alsoKnownAs)).toContainText('Remo elástico e2e')
  await expect(section(page, t.detail.primaryMuscles)).toContainText('Dorsales, Espalda media')
  await expect(section(page, t.detail.secondaryMuscles)).toContainText('Bíceps')
  await expect(section(page, t.detail.equipment)).toContainText('Bandas elásticas')
  await expect(section(page, t.detail.description).getByRole('listitem')).toHaveCount(2)
  expect(ownExercises(email)).toEqual(['Remo con banda propio e2e|reps_weight'])

  for (const text of ['remo con banda propio', 'remo elastico e2e']) {
    await page.goto('/ejercicios')
    await page.getByLabel(t.searchLabel).fill(text)
    const row = page.getByRole('tabpanel').getByRole('link', { name: /Remo con banda propio e2e/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText(t.originBadge.own)
  }
})

test('escenario 17: nombre vacío, tipo sin elegir y descripción enorme se rechazan sin guardar nada', async ({
  page,
}) => {
  const email = await registerUser(page)
  await page.goto('/ejercicios/nuevo')
  await saveButton(page).click()
  await expect(page.getByText(t.errors.nameRequired)).toBeVisible()
  await expect(page.getByText(t.errors.measurementRequired)).toBeVisible()
  await expect(nameField(page)).toBeFocused()

  await nameField(page).fill('Con descripción enorme e2e')
  await measurement(page, 'Tiempo').check()
  await page.getByLabel(f.description, { exact: false }).fill('a'.repeat(4001))
  await saveButton(page).click()
  await expect(page.getByText(t.errors.descriptionTooLong)).toBeVisible()
  expect(ownExercises(email)).toEqual([])
})

test('escenario 18: un nombre repetido entre los propios avisa y se guarda igual', async ({
  page,
}) => {
  const email = await registerUser(page)
  seedOwnExercise(email, { name: 'Mismo nombre e2e', measurement: 'duration' })
  await page.goto('/ejercicios/nuevo')
  await nameField(page).fill('mismo nombre e2e')
  await expect(page.getByText(f.duplicateName)).toBeVisible()
  await measurement(page, 'Tiempo').check()
  await saveButton(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'mismo nombre e2e' })).toBeVisible()
  expect(ownExercises(email)).toHaveLength(2)
})

test('escenario 19: un doble clic en «Guardar ejercicio» crea uno solo', async ({ page }) => {
  const email = await registerUser(page)
  await page.goto('/ejercicios/nuevo')
  await nameField(page).fill('Doble clic e2e')
  await measurement(page, 'Tiempo').check()
  await saveButton(page).dblclick()
  await expect(page.getByRole('heading', { level: 1, name: 'Doble clic e2e' })).toBeVisible()
  expect(ownExercises(email)).toEqual(['Doble clic e2e|duration'])
})

test('escenario 20: sin red avisa que no se guardó, conserva lo escrito y reintentar funciona', async ({
  page,
  context,
}) => {
  const email = await registerUser(page)
  await page.goto('/ejercicios/nuevo')
  await nameField(page).fill('Sin red e2e')
  await measurement(page, 'Tiempo').check()
  await context.setOffline(true)
  await saveButton(page).click()
  await expect(page.getByRole('alert').filter({ hasText: f.notSaved })).toBeVisible()
  await expect(nameField(page)).toHaveValue('Sin red e2e')
  expect(ownExercises(email)).toEqual([])

  await context.setOffline(false)
  await saveButton(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sin red e2e' })).toBeVisible()
  expect(ownExercises(email)).toEqual(['Sin red e2e|duration'])
})

test('escenario 21: el borrador vuelve tras recargar y se borra al cerrar sesión', async ({
  page,
}) => {
  const email = await registerUser(page)
  await page.goto('/ejercicios/nuevo')
  await nameField(page).fill('Borrador e2e')
  await expect
    .poll(() =>
      page.evaluate(
        () => Object.keys(localStorage).filter((k) => k.endsWith(':exercise-new')).length,
      ),
    )
    .toBe(1)
  await page.reload()
  await expect(nameField(page)).toHaveValue('Borrador e2e')
  await expect(page.getByText(f.draftRestored)).toBeVisible()

  await page.getByRole('button', { name: es.auth.actions.logout }).click()
  await login(page, email, PASSWORD)
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
  await page.goto('/ejercicios/nuevo')
  await expect(nameField(page)).toHaveValue('')
})

test('escenario 22: otra cuenta no ve ni puede abrir un ejercicio propio', async ({
  page,
  browser,
}) => {
  const emailA = await registerUser(page)
  const id = seedOwnExercise(emailA, { name: 'Privado de A e2e', measurement: 'duration' })

  const other = await browser.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('excb'))
  await other.goto('/ejercicios')
  await other.getByLabel(t.searchLabel).fill('privado de a e2e')
  await expect(other.getByText(t.emptyTitle)).toBeVisible()
  await other.goto(`/ejercicios/${id}`)
  await expect(other.getByText(t.notFound)).toBeVisible()
  await other.close()
})
