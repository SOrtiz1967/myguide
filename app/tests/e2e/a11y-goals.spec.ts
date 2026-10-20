// T045 (spec 004, escenario 30 del quickstart, SC-008): accesibilidad del objetivo y de la tarjeta del día.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { localDate, seedEntry, seedGoal, seedPendingEstimate } from './goals-support'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const g = es.goal
const card = (page: Page) => page.getByRole('region', { name: g.cardTitle })

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

let email = ''

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  email = uniqueEmail('a11yg')
  await register(page, email)
})

test('axe: la pantalla del objetivo, sin objetivo, con objetivo, con la nota y con el diálogo', async ({
  page,
}) => {
  await page.goto('/objetivo')
  await expect(page.getByText(g.page.none)).toBeVisible()
  await expectNoViolations(page, '/objetivo sin objetivo')

  // un valor inválido muestra su error vinculado al campo
  await page.getByLabel(g.page.fieldLabel, { exact: false }).fill('999')
  await page.getByRole('button', { name: g.page.save }).click()
  await expect(page.getByText(g.validation.range)).toBeVisible()
  await expectNoViolations(page, '/objetivo con un error de validación')

  seedGoal(email, 2000, localDate(-1))
  await page.goto('/objetivo')
  await expect(page.getByText(/^Vigente: 2\.000 kcal/)).toBeVisible()
  await expectNoViolations(page, '/objetivo con objetivo')

  await page.getByRole('button', { name: g.page.remove }).click()
  await expect(page.getByRole('dialog', { name: g.page.removeDialog.title })).toBeVisible()
  await expectNoViolations(page, 'el diálogo de quitar el objetivo')
  await page.keyboard.press('Escape')

  seedGoal(email, 1100, localDate())
  await page.goto('/objetivo')
  await expect(page.getByText(g.lowGoalNote)).toBeVisible()
  await expectNoViolations(page, '/objetivo con la nota informativa')
})

test('axe: la tarjeta del día sin objetivo, por debajo, superado, con faltantes y con estimados', async ({
  page,
}) => {
  seedEntry(email, { name: 'Sin objetivo a11y e2e', energy: 800, date: localDate(-4) })
  await page.goto(`/comidas/${localDate(-4)}`)
  await expect(card(page)).toContainText(g.registered(800, false))
  await expectNoViolations(page, 'el día sin objetivo')

  seedGoal(email, 2000, localDate(-3))
  seedEntry(email, { name: 'Por debajo a11y e2e', energy: 1350, date: localDate(-2) })
  await page.goto(`/comidas/${localDate(-2)}`)
  await expect(card(page).getByText('Restan 650 kcal')).toBeVisible()
  await expectNoViolations(page, 'el día por debajo del objetivo')

  seedEntry(email, { name: 'Superado a11y e2e', energy: 2600, date: localDate(-1) })
  await page.goto(`/comidas/${localDate(-1)}`)
  await expect(card(page).getByText(/más que el objetivo/)).toBeVisible()
  await expectNoViolations(page, 'el día con el objetivo superado')

  seedEntry(email, { name: 'Confirmado a11y e2e', energy: 700 })
  seedPendingEstimate(email, 300)
  await page.goto(`/comidas/${localDate()}`)
  await expect(card(page).getByText(g.pendingNote(300))).toBeVisible()
  await card(page).getByText(g.howTitle).click()
  await expect(card(page).getByText(g.how[0]!)).toBeVisible()
  await expectNoViolations(page, 'el día con estimados y «Cómo se calcula» abierto')
})

test('teclado: invitación, «Cambiar objetivo», «Cómo se calcula» y el diálogo con el foco devuelto', async ({
  page,
}) => {
  seedEntry(email, { name: 'Teclado a11y e2e', energy: 500 })
  await page.goto(`/comidas/${localDate()}`)

  // la invitación se alcanza con Tab y se abre con Enter
  const invite = card(page).getByRole('link', { name: g.invite })
  await invite.focus()
  await expect(invite).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/objetivo\?volver=/)

  // fijar el objetivo solo con el teclado
  const field = page.getByLabel(g.page.fieldLabel, { exact: false })
  await field.focus()
  await page.keyboard.type('2000')
  await page.keyboard.press('Enter')
  await expect(card(page).getByText(g.goalLine(2000))).toBeVisible()

  // «Cómo se calcula» se abre y se cierra con el teclado
  const how = card(page).getByText(g.howTitle)
  await how.focus()
  await page.keyboard.press('Enter')
  await expect(card(page).getByText(g.how[0]!)).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(card(page).getByText(g.how[0]!)).toBeHidden()

  // «Cambiar objetivo» → «Quitar objetivo» → el diálogo atrapa el foco y lo devuelve al cerrar
  await card(page).getByRole('link', { name: g.change }).focus()
  await page.keyboard.press('Enter')
  const remove = page.getByRole('button', { name: g.page.remove })
  await remove.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: g.page.removeDialog.title })
  await expect(dialog.getByRole('button', { name: g.page.removeDialog.cancel })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: g.page.removeDialog.confirm })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: g.page.removeDialog.cancel })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(remove).toBeFocused()
})

test('el estado se entiende sin color: con colores forzados el texto sigue diciendo qué pasa', async ({
  page,
}) => {
  seedGoal(email, 2000, localDate(-3))
  seedEntry(email, { name: 'Sin color a11y e2e', energy: 2300 })
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto(`/comidas/${localDate()}`)

  await expect(
    card(page).getByText('Registraste 300 kcal más que el objetivo de este día.'),
  ).toBeVisible()
  await expect(card(page).getByText('2.300 − 2.000 = 300 kcal')).toBeVisible()
  await expect(card(page).getByText('115 % del objetivo')).toBeVisible()
  // la barra es decorativa: ningún lector de pantalla depende de ella
  const hidden = await card(page)
    .locator('[data-goal-bar]')
    .evaluate((el) => el.closest('[aria-hidden="true"]') !== null)
  expect(hidden).toBe(true)
})
