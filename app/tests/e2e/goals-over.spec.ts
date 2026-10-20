// T036 (spec 004, escenarios 17 a 20 del quickstart): si se supera el objetivo, solo se informa.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { findForbidden } from '../support/forbiddenTerms'
import { localDate, savedGoals, seedEntry, seedGoal } from './goals-support'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const g = es.goal
const card = (page: Page) => page.getByRole('region', { name: g.cardTitle })

async function arrive(page: Page, goal: number) {
  const email = uniqueEmail('over')
  await register(page, email)
  seedGoal(email, goal, localDate(-3))
  return email
}

/** El color calculado de un elemento, y el del token de error, para comprobar que no se usa. */
async function colors(page: Page, element: Locator) {
  const own = await element.evaluate((el) => {
    const style = getComputedStyle(el)
    return { color: style.color, background: style.backgroundColor, weight: style.fontWeight }
  })
  const danger = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-danger)'
    document.body.append(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  })
  return { ...own, danger }
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 17: 2.250 con objetivo 2.000 informa la diferencia sin sugerencias ni alarma', async ({
  page,
}) => {
  const email = await arrive(page, 2000)
  seedEntry(email, { name: 'Cena grande over e2e', energy: 2250 })

  await page.goto('/comidas')
  const phrase = card(page).getByText('Registraste 250 kcal más que el objetivo de este día.')
  await expect(phrase).toBeVisible()
  await expect(card(page).getByText('2.250 − 2.000 = 250 kcal')).toBeVisible()

  // ningún término prohibido en el texto de la tarjeta ni de la pantalla del objetivo
  expect(findForbidden(await card(page).innerText())).toEqual([])
  await page.getByRole('link', { name: g.change }).click()
  await expect(page.getByRole('heading', { level: 1, name: g.page.title })).toBeVisible()
  expect(findForbidden(await page.getByRole('main').innerText())).toEqual([])
  await page.goBack()

  // sin estilo de alarma: ni el color de error ni íconos de advertencia
  const text = await colors(page, phrase)
  expect(text.color).not.toBe(text.danger)
  const bar = card(page).locator('[data-goal-bar]')
  const barColors = await colors(page, bar)
  expect(barColors.background).not.toBe(barColors.danger)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(card(page).locator('svg, img')).toHaveCount(0)

  // la barra del exceso es igual a la de antes de superarlo
  const width = await bar.evaluate((el) => (el as HTMLElement).style.width)
  expect(width).toBe('100%')
})

test('escenario 18: exactamente el objetivo restan 0 kcal, sin frase de exceso', async ({
  page,
}) => {
  const email = await arrive(page, 2000)
  seedEntry(email, { name: 'Justo over e2e', energy: 2000 })

  await page.goto('/comidas')
  await expect(
    card(page).getByText('Restan 0 kcal. Lo registrado coincide con el objetivo.'),
  ).toBeVisible()
  await expect(card(page)).not.toContainText('más que el objetivo')
})

test('escenario 19: fijar 1.100 kcal se guarda y muestra la nota informativa', async ({ page }) => {
  const email = uniqueEmail('over')
  await register(page, email)
  await page.goto('/objetivo')
  await page.getByLabel(g.page.fieldLabel, { exact: false }).fill('1100')
  await page.getByRole('button', { name: g.page.save }).click()

  await expect(page.getByRole('status').filter({ hasText: g.page.saved })).toBeVisible()
  expect(savedGoals(email)).toEqual(['1100'])
  await expect(card(page).getByText(g.lowGoalNote)).toBeVisible()

  await page.goto('/objetivo')
  await expect(page.getByText(g.lowGoalNote)).toBeVisible()
  expect(findForbidden(g.lowGoalNote)).toEqual([])
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('escenario 20: superar el objetivo varios días seguidos no cambia nada ni agrega avisos', async ({
  page,
}) => {
  const email = await arrive(page, 2000)
  for (let back = 0; back < 4; back++) {
    seedEntry(email, { name: `Exceso ${back} over e2e`, energy: 2600, date: localDate(-back) })
  }
  const before = savedGoals(email)

  for (let back = 0; back < 4; back++) {
    await page.goto(`/comidas/${localDate(-back)}`)
    await expect(card(page).getByText(/Registraste 600 kcal más que el objetivo/)).toBeVisible()
    await expect(card(page).getByText(g.goalLine(2000))).toBeVisible()
    await expect(card(page)).not.toContainText(/racha|puntaje|insignia|seguidos/i)
  }
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(savedGoals(email)).toEqual(before)
})
