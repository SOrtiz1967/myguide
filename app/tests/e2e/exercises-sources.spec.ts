// T060 (spec 005, escenario 29 del quickstart, FR-018): fuentes y licencias del catálogo de ejercicios.
import { expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedCatalogExercises } from './exercises-support'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.exercises

test.beforeAll(() => {
  clearSeededExercises()
  seedCatalogExercises([{ id: 'src1', name: 'Con procedencia e2e' }])
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail('exs'))
})

test('escenario 29: /fuentes tiene las secciones Alimentos y Ejercicios, con licencia y atribución', async ({
  page,
}) => {
  await page.goto('/fuentes')
  await expect(page.getByRole('heading', { level: 1, name: es.foods.sources.title })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: t.sources.foodsTitle })).toBeVisible()
  const exercises = page
    .getByRole('heading', { level: 2, name: t.sources.exercisesTitle })
    .locator('xpath=ancestor::section[1]')
  await expect(exercises).toBeVisible()

  const free = exercises.getByRole('article').filter({ hasText: 'free-exercise-db' })
  await expect(free.getByRole('link', { name: 'Unlicense' })).toHaveAttribute(
    'href',
    'https://unlicense.org/',
  )
  await expect(free).toContainText('dominio público')
  await expect(free).toContainText('traduj')
  await expect(free).toContainText(/\d+ ejercicios|\d\.\d{3} ejercicios/)

  const base = exercises.getByRole('article').filter({ hasText: 'MyGuide, ejercicios base' })
  await expect(base.getByRole('link', { name: 'CC0 1.0' })).toBeVisible()

  // la sección de alimentos sigue con sus fuentes
  const foods = page
    .getByRole('heading', { level: 2, name: t.sources.foodsTitle })
    .locator('xpath=ancestor::section[1]')
  await expect(foods.getByRole('article').filter({ hasText: 'Open Food Facts' })).toBeVisible()
})

test('desde la procedencia de un ejercicio del catálogo un clic lleva a las fuentes', async ({
  page,
}) => {
  await page.goto('/ejercicios')
  await page.getByLabel(t.searchLabel).fill('con procedencia e2e')
  await page
    .getByRole('tabpanel')
    .getByRole('link', { name: /Con procedencia e2e/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Con procedencia e2e' })).toBeVisible()
  await page.getByRole('link', { name: t.provenance.viewSources }).click()
  await expect(page).toHaveURL(/\/fuentes$/)
  await expect(
    page.getByRole('heading', { level: 2, name: t.sources.exercisesTitle }),
  ).toBeVisible()
})
