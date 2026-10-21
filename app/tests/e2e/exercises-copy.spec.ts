// T051 (spec 005, escenarios 23 y 24 del quickstart): crear mi versión de un ejercicio del catálogo.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededExercises,
  ownExercises,
  seedCatalogExercises,
  seedOwnExercise,
} from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.exercises
const f = t.form

const nameField = (page: Page) => page.getByLabel(f.name, { exact: true })
const descriptionField = (page: Page) => page.getByLabel(f.description, { exact: false })
const saveButton = (page: Page) => page.getByRole('button', { name: t.actions.save })
const section = (page: Page, title: string) =>
  page.getByRole('heading', { name: title }).locator('xpath=ancestor::section[1]')

test.beforeAll(() => {
  clearSeededExercises()
  seedCatalogExercises([
    {
      id: 'copy1',
      name: 'Original copiable e2e',
      originalName: 'Copyable Original',
      aliases: ['Copiable e2e alias'],
      primary: ['lats'],
      secondary: ['biceps'],
      equipment: 'cable',
      description: '1. Tira del cable.\n2. Vuelve despacio.',
      nameStatus: 'reviewed',
      descriptionStatus: 'reviewed',
    },
  ])
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

const originalId = () =>
  dbQuery("select id from public.exercises where source_item_id = 'E2E-copy1'")

test('escenario 23: la copia es editable, dice de dónde viene y el original no cambia para nadie', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('exc')
  await register(page, email)
  const id = originalId()

  await page.goto(`/ejercicios/${id}`)
  await page.getByRole('button', { name: t.actions.createMine }).click()
  await expect(page).toHaveURL(/\/editar$/)
  await expect(page.getByText(f.copyCreated)).toBeVisible()
  await expect(nameField(page)).toHaveValue('Original copiable e2e')
  await expect(descriptionField(page)).toHaveValue('1. Tira del cable.\n2. Vuelve despacio.')

  await nameField(page).fill('Mi versión del remo e2e')
  await descriptionField(page).fill('1. Tira con calma.\n2. Suelta sin prisa.')
  await saveButton(page).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mi versión del remo e2e' }),
  ).toBeVisible()
  await expect(page.getByText(f.saved)).toBeVisible()
  await expect(section(page, t.provenance.title)).toContainText(t.provenance.ownBasedOnPrefix)
  await expect(section(page, t.detail.description).getByRole('listitem').first()).toHaveText(
    'Tira con calma.',
  )
  expect(ownExercises(email)).toEqual(['Mi versión del remo e2e|reps_weight'])

  // el enlace lleva al original, que sigue igual
  await page.getByRole('link', { name: 'Original copiable e2e' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Original copiable e2e' })).toBeVisible()
  await expect(section(page, t.detail.description).getByRole('listitem').first()).toHaveText(
    'Tira del cable.',
  )
  await expect(page.getByRole('link', { name: t.actions.edit })).toHaveCount(0)

  // en la búsqueda se distinguen el original y la versión propia
  await page.goto('/ejercicios')
  await page.getByLabel(t.searchLabel).fill('versión del remo e2e')
  const rows = page.getByRole('tabpanel').getByRole('link')
  await expect(rows.filter({ hasText: 'Mi versión del remo e2e' })).toContainText(
    t.originBadge.copy,
  )
  await page.getByLabel(t.searchLabel).fill('original copiable')
  await expect(rows.filter({ hasText: 'Original copiable e2e' })).toContainText(
    t.originBadge.catalog,
  )

  // otra cuenta ve el original intacto y no ve la copia
  const context = await browser.newContext()
  const other = await context.newPage()
  await stubTurnstile(other)
  await register(other, uniqueEmail('excb'))
  await other.goto(`/ejercicios/${id}`)
  await expect(
    other.getByRole('heading', { level: 1, name: 'Original copiable e2e' }),
  ).toBeVisible()
  await expect(section(other, t.detail.description).getByRole('listitem').first()).toHaveText(
    'Tira del cable.',
  )
  await other.goto('/ejercicios')
  await other.getByLabel(t.searchLabel).fill('mi versión del remo')
  await expect(other.getByText(t.emptyTitle)).toBeVisible()
  await context.close()

  // una nueva importación cambia el original; la copia conserva lo suyo
  dbQuery(
    "update public.exercises set name = 'Original copiable e2e v2' where source_item_id = 'E2E-copy1'",
  )
  expect(ownExercises(email)).toEqual(['Mi versión del remo e2e|reps_weight'])
  dbQuery(
    "update public.exercises set name = 'Original copiable e2e' where source_item_id = 'E2E-copy1'",
  )
})

test('escenario 24: copiar lo propio y copiar dos veces crea copias independientes', async ({
  page,
}) => {
  const email = uniqueEmail('exc')
  await register(page, email)
  const ownId = seedOwnExercise(email, {
    name: 'Propio para copiar e2e',
    measurement: 'duration',
    primary: ['abdominals'],
  })

  await page.goto(`/ejercicios/${ownId}`)
  await page.getByRole('button', { name: t.actions.copy }).click()
  await expect(page).toHaveURL(/\/editar$/)
  await nameField(page).fill('Copia uno e2e')
  await saveButton(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Copia uno e2e' })).toBeVisible()

  // volver al propio y copiar de nuevo: otra copia, independiente de la primera
  await page.goto(`/ejercicios/${ownId}`)
  await page.getByRole('button', { name: t.actions.copy }).click()
  await expect(page).toHaveURL(/\/editar$/)
  await nameField(page).fill('Copia dos e2e')
  await saveButton(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Copia dos e2e' })).toBeVisible()

  expect(ownExercises(email).sort()).toEqual([
    'Copia dos e2e|duration',
    'Copia uno e2e|duration',
    'Propio para copiar e2e|duration',
  ])
  expect(
    dbQuery(
      `select count(distinct id) from public.exercises where based_on_exercise_id = '${ownId}'`,
    ),
  ).toBe('2')

  // el propio no cambió
  await page.goto(`/ejercicios/${ownId}`)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Propio para copiar e2e' }),
  ).toBeVisible()
})
