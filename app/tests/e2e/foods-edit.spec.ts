// T061 (spec 002, escenarios 19 a 21 del quickstart): editar y eliminar alimentos propios.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededFoods,
  dbQuery,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  uniqueEmail,
} from './support'

const field = (page: Page, text: string) => page.getByLabel(text, { exact: false })
const save = (page: Page) => page.getByRole('button', { name: es.foods.actions.save })

async function createFood(page: Page, name: string, energy: string) {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill(name)
  await field(page, 'Energía (kcal)').fill(energy)
  await save(page).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test.beforeAll(() => {
  clearSeededFoods()
  seedCatalogFoods([{ id: 'edit1', name: 'Catalogo de solo lectura e2e', energy: 100 }])
})

test.afterAll(() => {
  clearSeededFoods()
})

// Los alimentos propios de corridas anteriores no deben contarse en esta (todos llevan "e2e" en el nombre).
function cleanOwnFoods() {
  dbQuery("delete from public.foods where origin = 'own' and name like '%e2e%'")
}

test.beforeAll(cleanOwnFoods)
test.afterAll(cleanOwnFoods)

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail())
})

test('escenario 19: editar un alimento propio lo actualiza y eliminarlo lo hace desaparecer', async ({
  page,
}) => {
  await createFood(page, 'Para editar e2e19', '200')

  await page.getByRole('link', { name: es.foods.actions.edit }).click()
  await field(page, 'Nombre').fill('Editado e2e19')
  await field(page, 'Energía (kcal)').fill('250')
  await save(page).click()
  await expect(page.getByText(es.foods.form.saved)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Editado e2e19' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Energía/ })).toContainText('250 kcal')

  // eliminar con confirmación: cancelar no elimina
  await page.getByRole('button', { name: es.foods.actions.delete }).click()
  const dialog = page.getByRole('dialog', { name: es.foods.form.deleteTitle })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Editado e2e19' })).toBeVisible()

  // confirmar elimina y deja de aparecer en la búsqueda
  await page.getByRole('button', { name: es.foods.actions.delete }).click()
  await page.getByRole('button', { name: es.foods.actions.confirmDelete }).click()
  await expect(page.getByText(es.foods.form.deleted)).toBeVisible()
  await page.getByRole('searchbox', { name: es.foods.searchLabel }).fill('Editado e2e19')
  await expect(page.getByText(es.foods.emptyTitle)).toBeVisible()
  expect(dbQuery("select count(*) from public.foods where name = 'Editado e2e19'")).toBe('0')
})

test('escenario 20: el catálogo no se puede editar ni eliminar; solo ofrece crear mi versión', async ({
  page,
}) => {
  const id = dbQuery("select id from public.foods where source_item_id = 'E2E-edit1'")
  await page.goto(`/alimentos/${id}`)
  await expect(page.getByRole('button', { name: es.foods.actions.createMine })).toBeVisible()
  await expect(page.getByRole('link', { name: es.foods.actions.edit })).toHaveCount(0)
  await expect(page.getByRole('button', { name: es.foods.actions.delete })).toHaveCount(0)

  // ni siquiera por la dirección de edición
  await page.goto(`/alimentos/${id}/editar`)
  await expect(page.getByText(es.foods.form.editNotAllowed)).toBeVisible()
  await expect(save(page)).toHaveCount(0)
})

test('escenario 21: cortar la red al guardar avisa que no se guardó y conserva el borrador', async ({
  page,
  context,
}) => {
  await createFood(page, 'Corte de red e2e21', '100')
  await page.getByRole('link', { name: es.foods.actions.edit }).click()
  await field(page, 'Nombre').fill('Cambio sin guardar e2e21')

  await context.setOffline(true)
  await save(page).click()
  await expect(page.getByRole('alert').filter({ hasText: es.errors.offline })).toBeVisible()
  await expect(page.getByText(es.foods.form.saved)).toHaveCount(0)
  await expect(field(page, 'Nombre')).toHaveValue('Cambio sin guardar e2e21')
  expect(dbQuery("select count(*) from public.foods where name = 'Cambio sin guardar e2e21'")).toBe(
    '0',
  )

  // al volver la conexión y recargar, el borrador se recupera
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText(es.foods.form.draftRestored)).toBeVisible()
  await expect(field(page, 'Nombre')).toHaveValue('Cambio sin guardar e2e21')
})
