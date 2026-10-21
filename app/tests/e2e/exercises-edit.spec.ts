// T056 (spec 005, escenarios 25 y 26 del quickstart): editar y eliminar ejercicios propios.
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
const saveButton = (page: Page) => page.getByRole('button', { name: t.actions.save })
const section = (page: Page, title: string) =>
  page.getByRole('heading', { name: title }).locator('xpath=ancestor::section[1]')

test.beforeAll(() => {
  clearSeededExercises()
  seedCatalogExercises([{ id: 'edit1', name: 'Catálogo de solo lectura e2e' }])
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 25: editar un ejercicio propio lo actualiza y eliminarlo lo hace desaparecer, sin tocar sus copias', async ({
  page,
}) => {
  const email = uniqueEmail('exc')
  await register(page, email)
  const id = seedOwnExercise(email, {
    name: 'Para editar e2e25',
    measurement: 'duration',
    primary: ['abdominals'],
    equipment: 'body only',
    description: 'Aguanta.',
  })

  // una copia hecha antes: debe seguir igual
  await page.goto(`/ejercicios/${id}`)
  await page.getByRole('button', { name: t.actions.copy }).click()
  await expect(page).toHaveURL(/\/editar$/)
  await saveButton(page).click()
  await expect(page.getByText(f.saved)).toBeVisible()
  expect(ownExercises(email)).toHaveLength(2)

  // editar el original: nombre, tipo de medición, músculo y descripción
  await page.goto(`/ejercicios/${id}`)
  await page.getByRole('link', { name: t.actions.edit }).click()
  await expect(nameField(page)).toHaveValue('Para editar e2e25')
  await nameField(page).fill('Editado e2e25')
  await page.getByRole('radio', { name: /^Repeticiones \(peso corporal\)/ }).check()
  await page.getByRole('group', { name: f.primaryLegend }).getByLabel('Pecho').check()
  await page.getByLabel(f.description, { exact: false }).fill('1. Baja.\n2. Sube.')
  await saveButton(page).click()

  await expect(page.getByText(f.saved)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Editado e2e25' })).toBeVisible()
  await expect(section(page, t.detail.primaryMuscles)).toContainText('Abdominales, Pecho')
  await expect(section(page, t.detail.measurement)).toContainText(
    es.exercises.measurement.reps_bodyweight,
  )
  await expect(section(page, t.detail.description).getByRole('listitem')).toHaveCount(2)
  expect(
    dbQuery(`select name || '|' || measurement_type from public.exercises where id = '${id}'`),
  ).toBe('Editado e2e25|reps_bodyweight')
  // la copia no cambió
  expect(
    dbQuery(
      `select name || '|' || measurement_type from public.exercises where based_on_exercise_id = '${id}'`,
    ),
  ).toBe('Para editar e2e25|duration')

  // eliminar con confirmación: Escape cancela
  await page.getByRole('button', { name: t.actions.delete }).click()
  const dialog = page.getByRole('dialog', { name: f.deleteTitle })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Editado e2e25' })).toBeVisible()

  // confirmar elimina y deja de aparecer en la búsqueda
  await page.getByRole('button', { name: t.actions.delete }).click()
  await page.getByRole('button', { name: t.actions.confirmDelete }).click()
  await expect(page.getByText(f.deleted)).toBeVisible()
  await page.getByLabel(t.searchLabel).fill('Editado e2e25')
  await expect(page.getByText(t.emptyTitle)).toBeVisible()
  expect(dbQuery(`select count(*) from public.exercises where id = '${id}'`)).toBe('0')

  // la copia sigue, ahora sin referencia al original eliminado
  expect(
    dbQuery(
      "select name || '|' || coalesce(based_on_exercise_id::text, 'sin original') from public.exercises where name = 'Para editar e2e25'",
    ),
  ).toBe('Para editar e2e25|sin original')
})

test('escenario 26: el catálogo no se puede editar ni eliminar; solo ofrece crear mi versión', async ({
  page,
}) => {
  await register(page, uniqueEmail('exc'))
  const id = dbQuery("select id from public.exercises where source_item_id = 'E2E-edit1'")

  await page.goto(`/ejercicios/${id}`)
  await expect(page.getByRole('button', { name: t.actions.createMine })).toBeVisible()
  await expect(page.getByRole('link', { name: t.actions.edit })).toHaveCount(0)
  await expect(page.getByRole('button', { name: t.actions.delete })).toHaveCount(0)

  // ni siquiera por la dirección de edición
  await page.goto(`/ejercicios/${id}/editar`)
  await expect(page.getByText(f.editNotAllowed)).toBeVisible()
  await expect(saveButton(page)).toHaveCount(0)
})

test('cortar la red al guardar avisa que no se guardó y conserva el borrador', async ({
  page,
  context,
}) => {
  const email = uniqueEmail('exc')
  await register(page, email)
  const id = seedOwnExercise(email, { name: 'Corte de red e2e', measurement: 'duration' })
  await page.goto(`/ejercicios/${id}/editar`)
  await nameField(page).fill('Cambio sin guardar e2e')

  await context.setOffline(true)
  await saveButton(page).click()
  await expect(page.getByRole('alert').filter({ hasText: es.errors.offline })).toBeVisible()
  await expect(page.getByText(f.saved)).toHaveCount(0)
  await expect(nameField(page)).toHaveValue('Cambio sin guardar e2e')
  expect(ownExercises(email)).toEqual(['Corte de red e2e|duration'])

  // al volver la conexión y recargar, el borrador se recupera
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText(f.draftRestored)).toBeVisible()
  await expect(nameField(page)).toHaveValue('Cambio sin guardar e2e')
})
