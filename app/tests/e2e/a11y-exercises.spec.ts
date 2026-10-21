// T062 (spec 005, escenario 31, FR-036): accesibilidad de las pantallas de ejercicios (axe) y recorrido por teclado.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedCatalogExercises } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.exercises
const f = t.form

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
  seedCatalogExercises([
    {
      id: 'a11y1',
      name: 'Ejercicio accesible e2e',
      originalName: 'Accessible Exercise',
      aliases: ['Otro nombre accesible e2e'],
      measurement: 'reps_weight',
      primary: ['lats'],
      secondary: ['biceps'],
      equipment: 'cable',
      description: '1. Siéntate.\n2. Tira del cable.\n3. Vuelve despacio.',
    },
  ])
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail('exa11y'))
})

test('axe: búsqueda, detalle, formulario, edición y fuentes no tienen violaciones graves', async ({
  page,
}) => {
  await page.goto('/ejercicios?q=ejercicio+accesible+e2e')
  await expect(page.getByRole('link', { name: /Ejercicio accesible e2e/ })).toBeVisible()
  await expectNoViolations(page, '/ejercicios con resultados')

  await page.goto('/ejercicios?q=nada+que+encontrar+xyz')
  await expect(page.getByText(t.emptyTitle)).toBeVisible()
  await expectNoViolations(page, '/ejercicios vacío')

  await page.goto('/ejercicios?q=ejercicio+accesible+e2e&musculo=neck&equipo=foam+roll')
  await expect(page.getByText(t.emptyFiltersTitle)).toBeVisible()
  await expectNoViolations(page, '/ejercicios con filtros sin resultados')

  const id = dbQuery("select id from public.exercises where source_item_id = 'E2E-a11y1'")
  await page.goto(`/ejercicios/${id}`)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ejercicio accesible e2e' }),
  ).toBeVisible()
  await expectNoViolations(page, 'detalle de un ejercicio del catálogo')

  await page.goto('/ejercicios/nuevo')
  await page.getByRole('button', { name: t.actions.save }).click()
  await expect(page.getByText(t.errors.nameRequired)).toBeVisible()
  await expectNoViolations(page, 'formulario con errores')

  await page.getByLabel(f.name, { exact: true }).fill('Propio accesible e2e')
  await page.getByRole('radio', { name: /^Tiempo/ }).check()
  await page.getByRole('button', { name: t.actions.save }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Propio accesible e2e' })).toBeVisible()
  await expectNoViolations(page, 'detalle de un ejercicio propio')

  await page.getByRole('link', { name: t.actions.edit }).click()
  await expect(page.getByRole('heading', { level: 1, name: f.editTitle })).toBeVisible()
  await expectNoViolations(page, 'edición')

  await page.goto('/fuentes')
  await expect(
    page.getByRole('heading', { level: 2, name: t.sources.exercisesTitle }),
  ).toBeVisible()
  await expectNoViolations(page, '/fuentes')
})

test('el tipo de medición se entiende con texto, sin depender de un ícono', async ({ page }) => {
  await page.goto('/ejercicios?q=ejercicio+accesible+e2e')
  const row = page.getByRole('link', { name: /Ejercicio accesible e2e/ })
  await expect(row).toContainText('Repeticiones y peso')
  const id = dbQuery("select id from public.exercises where source_item_id = 'E2E-a11y1'")
  await page.goto(`/ejercicios/${id}`)
  await expect(
    page.getByRole('heading', { name: t.detail.measurement }).locator('xpath=ancestor::section[1]'),
  ).toContainText(t.measurement.reps_weight)
})

test('teclado: las pestañas se recorren con las flechas y los resultados con Tab', async ({
  page,
}) => {
  await page.goto('/ejercicios?q=ejercicio+accesible+e2e')
  await expect(page.getByRole('link', { name: /Ejercicio accesible e2e/ })).toBeVisible()

  await page.getByRole('tab', { name: t.tabs.all }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: t.tabs.catalog })).toBeFocused()
  await expect(page.getByRole('tab', { name: t.tabs.catalog })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: t.tabs.own })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(page.getByRole('tab', { name: t.tabs.all })).toBeFocused()

  // Tab sale de las pestañas (solo la activa está en el orden de tabulación) y llega al primer resultado.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: /Ejercicio accesible e2e/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ejercicio accesible e2e' }),
  ).toBeVisible()
})

test('teclado: los filtros se cambian y se quitan sin mouse', async ({ page }) => {
  await page.goto('/ejercicios?q=ejercicio+accesible+e2e')
  await expect(page.getByRole('link', { name: /Ejercicio accesible e2e/ })).toBeVisible()

  const muscle = page.getByRole('combobox', { name: t.filters.muscle })
  await muscle.focus()
  await muscle.selectOption('lats')
  await expect(page).toHaveURL(/musculo=lats/)
  const remove = page.getByRole('button', { name: t.filters.remove('Dorsales') })
  await remove.focus()
  await page.keyboard.press('Enter')
  await expect(page).not.toHaveURL(/musculo=/)
})

test('teclado: los grupos de casillas y de botones de radio del formulario', async ({ page }) => {
  await page.goto('/ejercicios/nuevo')

  // las casillas de músculos se marcan con la barra espaciadora
  const lats = page.getByRole('group', { name: f.primaryLegend }).getByLabel('Dorsales')
  await lats.focus()
  await page.keyboard.press('Space')
  await expect(lats).toBeChecked()
  await page.keyboard.press('Space')
  await expect(lats).not.toBeChecked()

  // los botones de radio del tipo de medición se recorren con las flechas
  const radios = page.getByRole('radiogroup', { name: f.measurementLegend }).getByRole('radio')
  await radios.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(radios.nth(1)).toBeChecked()
  await expect(radios.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(radios.nth(2)).toBeChecked()
})

test('teclado: el diálogo de eliminar atrapa el foco, Escape cancela y el foco vuelve', async ({
  page,
}) => {
  await page.goto('/ejercicios/nuevo')
  await page.getByLabel(f.name, { exact: true }).fill('A eliminar a11y e2e')
  await page.getByRole('radio', { name: /^Tiempo/ }).check()
  await page.getByRole('button', { name: t.actions.save }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'A eliminar a11y e2e' })).toBeVisible()

  const trigger = page.getByRole('button', { name: t.actions.delete })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: f.deleteTitle })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: t.actions.cancel })).toBeFocused()
  await expectNoViolations(page, 'diálogo de confirmación')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: t.actions.confirmDelete })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: t.actions.cancel })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
