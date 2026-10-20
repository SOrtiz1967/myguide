// T032 (spec 004, escenarios 13 a 16 del quickstart): qué tan firme es la cifra.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededEntries,
  clearSeededFoods,
  dbQuery,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  uniqueEmail,
} from './support'
import { localDate, seedEntry, seedGoal, seedPendingEstimate, userId } from './goals-support'

const g = es.goal
const card = (page: Page) => page.getByRole('region', { name: g.cardTitle })

async function arrive(page: Page) {
  const email = uniqueEmail('unc')
  await register(page, email)
  seedGoal(email, 2000, localDate(-3))
  return email
}

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([{ id: 'unc1', name: 'Sin energia unc e2e', energy: null }])
})

test.afterAll(() => {
  clearSeededEntries()
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 13: un ítem sin dato de energía vuelve el restante un máximo', async ({ page }) => {
  const email = await arrive(page)
  seedEntry(email, { name: 'Con energia unc e2e', energy: 1350 })
  dbQuery(
    `select tests.create_meal_entry('${userId(email)}', '${localDate()}', 'snack', (select id from public.foods where source_item_id = 'E2E-unc1'), 100)`,
  )

  await page.goto('/comidas')
  await expect(card(page).getByText('Restan como máximo 650 kcal')).toBeVisible()
  await expect(card(page).getByText(g.missingNote(1))).toBeVisible()
  await expect(card(page).getByText('Restan 650 kcal', { exact: true })).toHaveCount(0)
})

test('escenario 14: un estimado sin confirmar entra en lo registrado y se muestra aparte', async ({
  page,
}) => {
  const email = await arrive(page)
  seedEntry(email, { name: 'Confirmado unc e2e', energy: 1000 })
  seedPendingEstimate(email, 300)

  await page.goto('/comidas')
  await expect(card(page).getByText('Restan 700 kcal')).toBeVisible()
  await expect(card(page).getByText(g.pendingNote(300))).toBeVisible()
})

test('escenario 15: todo confirmado y con energía no lleva ninguna aclaración', async ({
  page,
}) => {
  const email = await arrive(page)
  seedEntry(email, { name: 'Uno unc e2e', energy: 1000 })
  seedEntry(email, { name: 'Dos unc e2e', energy: 350 })

  await page.goto('/comidas')
  await expect(card(page).getByText('Restan 650 kcal')).toBeVisible()
  await expect(card(page)).not.toContainText(/no tiene|no tienen|como máximo|al menos|estimadas/)
})

test('escenario 16: «Cómo se calcula» explica la fórmula con el teclado', async ({ page }) => {
  const email = await arrive(page)
  seedEntry(email, { name: 'Tres unc e2e', energy: 1350 })

  await page.goto('/comidas')
  const summary = card(page).getByText(g.howTitle)
  await summary.focus()
  await page.keyboard.press('Enter')
  for (const line of g.how) await expect(card(page).getByText(line)).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(card(page).getByText(g.how[0]!)).toBeHidden()
})
