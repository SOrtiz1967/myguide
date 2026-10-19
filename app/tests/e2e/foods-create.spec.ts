// T033 (spec 002, escenarios 9 a 15 del quickstart): crear alimentos propios.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const field = (page: Page, text: string) => page.getByLabel(text, { exact: false })
const save = (page: Page) => page.getByRole('button', { name: es.foods.actions.save })

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail())
})

test('escenario 9: un alimento con solo nombre y energía se guarda y el resto dice "sin dato"', async ({
  page,
}) => {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill('Galletita casera e2e9')
  await field(page, 'Energía (kcal)').fill('450')
  await save(page).click()

  await expect(page.getByText(es.foods.form.saved)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Galletita casera e2e9' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Energía/ })).toContainText('450 kcal')
  await expect(page.getByRole('row', { name: /Proteínas/ })).toContainText('sin dato')
  await expect(page.getByText(es.foods.provenance.own, { exact: true })).toBeVisible()
})

test('escenario 10: un alimento con varias porciones las muestra aparte', async ({ page }) => {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill('Arroz casero e2e10')
  await field(page, 'Energía (kcal)').fill('130')
  await page.getByRole('button', { name: es.foods.actions.addPortion }).click()
  await page.getByRole('button', { name: es.foods.actions.addPortion }).click()
  await page.getByLabel(es.foods.form.portionName).first().fill('Taza')
  await page.getByLabel(es.foods.form.portionName).nth(1).fill('Cucharada')
  await page.getByLabel(`${es.foods.form.portionAmount} (g)`).first().fill('158')
  await page.getByLabel(`${es.foods.form.portionAmount} (g)`).nth(1).fill('12,5')
  await save(page).click()

  await expect(page.getByText('Taza: 158 g')).toBeVisible()
  await expect(page.getByText('Cucharada: 12,5 g')).toBeVisible()
})

test('escenario 11: valores imposibles se rechazan con un mensaje claro', async ({ page }) => {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill('Imposible e2e11')
  await field(page, 'Energía (kcal)').fill('100')
  await field(page, 'Proteínas (g)').fill('-4')
  await save(page).click()
  await expect(page.getByText(es.foods.errors.negative)).toBeVisible()
  await expect(field(page, 'Proteínas (g)')).toBeFocused()

  await field(page, 'Proteínas (g)').fill('60')
  await field(page, 'Carbohidratos (g)').fill('30')
  await field(page, 'Grasas totales (g)').fill('20')
  await save(page).click()
  await expect(page.getByText(es.foods.errors.macrosOver100)).toBeVisible()
  expect(dbQuery("select count(*) from public.foods where name = 'Imposible e2e11'")).toBe('0')
})

test('escenario 12: una energía que no coincide con los macros avisa pero permite guardar', async ({
  page,
}) => {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill('Incoherente e2e12')
  await field(page, 'Energía (kcal)').fill('800')
  await field(page, 'Proteínas (g)').fill('10')
  await field(page, 'Carbohidratos (g)').fill('10')
  await field(page, 'Grasas totales (g)').fill('10')
  await expect(page.getByText(/no coincide con los macronutrientes/)).toBeVisible()
  await save(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Incoherente e2e12' })).toBeVisible()
})

test('escenario 13: la coma decimal se interpreta bien', async ({ page }) => {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill('Coma e2e13')
  await field(page, 'Energía (kcal)').fill('300')
  await field(page, 'Proteínas (g)').fill('12,5')
  await save(page).click()
  await expect(page.getByRole('row', { name: /Proteínas/ })).toContainText('12,5 g')
})

test('escenario 14: otra cuenta no encuentra mi alimento', async ({ page, browser }) => {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill('Privado e2e14')
  await field(page, 'Energía (kcal)').fill('100')
  await save(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Privado e2e14' })).toBeVisible()
  const url = page.url()

  // Mi propia búsqueda lo encuentra...
  await page.goto('/alimentos?q=privado+e2e14')
  await expect(page.getByRole('link', { name: /Privado e2e14/ })).toBeVisible()

  // ...otra cuenta no lo ve ni por la búsqueda ni por su dirección.
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await stubTurnstile(otherPage)
  await register(otherPage, uniqueEmail('otra'))
  await otherPage.goto('/alimentos?q=privado+e2e14')
  await expect(otherPage.getByText(es.foods.emptyTitle)).toBeVisible()
  await otherPage.goto(new URL(url).pathname)
  await expect(otherPage.getByText(es.foods.notFound)).toBeVisible()
  await other.close()
})

test('escenario 15: el doble clic en Guardar crea un solo alimento', async ({ page }) => {
  await page.goto('/alimentos/nuevo')
  await field(page, 'Nombre').fill('Doble e2e15')
  await field(page, 'Energía (kcal)').fill('100')
  await save(page).dblclick()
  await expect(page.getByRole('heading', { level: 1, name: 'Doble e2e15' })).toBeVisible()
  expect(dbQuery("select count(*) from public.foods where name = 'Doble e2e15'")).toBe('1')
})

test('el botón "Crear" de una búsqueda vacía precarga el nombre', async ({ page }) => {
  await page.goto('/alimentos')
  await page.getByRole('searchbox', { name: es.foods.searchLabel }).fill('quinoa soplada e2e')
  await page.getByRole('button', { name: es.foods.createNamed('quinoa soplada e2e') }).click()
  await expect(field(page, 'Nombre')).toHaveValue('quinoa soplada e2e')
})
