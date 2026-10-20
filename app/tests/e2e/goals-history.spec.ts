// T042 (spec 004, escenarios 21 a 27 del quickstart): revisar, cambiar o quitar el objetivo sin alterar el pasado.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { localDate, savedGoals, seedEntry, seedGoal, userId } from './goals-support'
import {
  dayIn,
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  uniqueEmail,
  zoneWhereItIsOneAm,
} from './support'

const g = es.goal
const card = (page: Page) => page.getByRole('region', { name: g.cardTitle })
const field = (page: Page) => page.getByLabel(g.page.fieldLabel, { exact: false })

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

async function arrive(page: Page) {
  const email = uniqueEmail('hist')
  await register(page, email)
  return email
}

async function setGoalInUi(page: Page, value: string) {
  await page.goto('/objetivo')
  await field(page).fill(value)
  await page.getByRole('button', { name: g.page.save }).click()
  await expect(page.getByRole('status').filter({ hasText: g.page.saved })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
})

test('escenario 21: cambiar de 2.000 a 1.800 rige desde hoy y ayer sigue con 2.000', async ({
  page,
}) => {
  const email = await arrive(page)
  seedGoal(email, 2000, localDate(-7), daysAgo(7))
  await setGoalInUi(page, '1800')

  await expect(card(page)).toContainText(g.goalLine(1800))
  await page.getByRole('link', { name: /Día anterior/ }).click()
  await expect(card(page)).toContainText(g.goalLine(2000))
  expect(savedGoals(email)).toEqual(['2000', '1800'])
})

test('escenario 22: dos cambios el mismo día, rige el último guardado', async ({ page }) => {
  const email = await arrive(page)
  await setGoalInUi(page, '1900')
  await setGoalInUi(page, '1700')

  await expect(card(page)).toContainText(g.goalLine(1700))
  expect(savedGoals(email)).toEqual(['1900', '1700'])
  await page.goto('/objetivo')
  await expect(page.getByText(/^Vigente: 1\.700 kcal/)).toBeVisible()
})

test('escenario 23: quitar y volver a fijar el objetivo', async ({ page }) => {
  const email = await arrive(page)
  seedGoal(email, 2000, localDate(-7), daysAgo(7))
  seedGoal(email, null, localDate(-3), daysAgo(3))

  // desde hace tres días no hay objetivo; los anteriores conservan el suyo
  await page.goto(`/comidas/${localDate(-2)}`)
  await expect(card(page)).not.toContainText(g.goalLine(2000))
  await expect(card(page).getByRole('link', { name: g.invite })).toHaveCount(0) // día pasado
  await page.goto(`/comidas/${localDate(-4)}`)
  await expect(card(page)).toContainText(g.goalLine(2000))

  // volver a fijarlo rige desde hoy; los días intermedios siguen sin objetivo
  await setGoalInUi(page, '1600')
  await expect(card(page)).toContainText(g.goalLine(1600))
  await page.goto(`/comidas/${localDate(-2)}`)
  await expect(card(page)).not.toContainText(/Objetivo:/)

  // quitarlo desde la pantalla: desde hoy no hay objetivo, ayer no cambia
  await page.goto('/objetivo')
  await page.getByRole('button', { name: g.page.remove }).click()
  await page
    .getByRole('dialog', { name: g.page.removeDialog.title })
    .getByRole('button', { name: g.page.removeDialog.confirm })
    .click()
  await expect(page.getByRole('status').filter({ hasText: g.page.removed })).toBeVisible()
  await expect(card(page)).not.toContainText(/Objetivo:/)
  await expect(card(page)).not.toContainText(/restan/i)
  await expect(card(page).getByRole('link', { name: g.invite })).toBeVisible()
  expect(savedGoals(email)).toEqual(['2000', 'quitado', '1600', 'quitado'])
})

test('escenario 24: los días anteriores a la primera vez muestran solo lo registrado', async ({
  page,
}) => {
  const email = await arrive(page)
  seedGoal(email, 2000, localDate(-2), daysAgo(2))
  seedEntry(email, { name: 'Antes history e2e', energy: 400, date: localDate(-5) })

  await page.goto(`/comidas/${localDate(-5)}`)
  await expect(card(page)).toContainText(g.registered(400, false))
  await expect(card(page)).not.toContainText(/restan|objetivo:/i)
})

test('escenario 25: una fecha futura cercana muestra el objetivo vigente hoy', async ({ page }) => {
  const email = await arrive(page)
  seedGoal(email, 1800, localDate(-1), daysAgo(1))
  await page.goto(`/comidas/${localDate(3)}`)
  await expect(card(page)).toContainText(g.goalLine(1800))
})

test('escenario 26: cambiar la zona del perfil no cambia el objetivo de los días ya vividos', async ({
  page,
}) => {
  const email = await arrive(page)
  seedGoal(email, 2000, localDate(-6), daysAgo(6))
  const before = savedGoals(email)

  dbQuery(
    `update public.profiles set timezone = 'Pacific/Auckland' where user_id = '${userId(email)}'`,
  )
  await page.goto(`/comidas/${localDate(-3)}`)
  await expect(card(page)).toContainText(g.goalLine(2000))
  dbQuery(
    `update public.profiles set timezone = 'America/Los_Angeles' where user_id = '${userId(email)}'`,
  )
  await page.goto(`/comidas/${localDate(-3)}`)
  await expect(card(page)).toContainText(g.goalLine(2000))
  expect(savedGoals(email)).toEqual(before)
})

test('escenario 27: cambiar el objetivo a la 01:00 rige desde el día nuevo, no desde el que se cierra', async ({
  page,
}) => {
  const zone = zoneWhereItIsOneAm()
  const today = dayIn(zone)
  const yesterday = dayIn(zone, -1)
  const email = await arrive(page)
  dbQuery(`update public.profiles set timezone = '${zone}' where user_id = '${userId(email)}'`)
  seedGoal(email, 2000, dayIn(zone, -5), daysAgo(5))
  seedEntry(email, {
    name: 'Cena que se cierra history e2e',
    energy: 700,
    date: yesterday,
    meal: 'dinner',
  })

  await setGoalInUi(page, '1500')
  expect(
    dbQuery(
      `select effective_from from public.energy_goals where user_id = '${userId(email)}' and kcal = 1500`,
    ),
  ).toBe(today)

  await page.goto(`/comidas/${yesterday}`)
  await expect(card(page)).toContainText(g.goalLine(2000))
  await page.goto(`/comidas/${today}`)
  await expect(card(page)).toContainText(g.goalLine(1500))
})
