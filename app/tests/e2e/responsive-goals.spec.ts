// T046 (spec 004, escenario 30 del quickstart, SC-008): el objetivo y la tarjeta del día funcionan en
// teléfono y en escritorio, sin desplazamiento horizontal y con áreas táctiles de 44 px o más.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { localDate, seedEntry, seedGoal } from './goals-support'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const g = es.goal
const card = (page: Page) => page.getByRole('region', { name: g.cardTitle })

const VIEWPORTS = [
  { name: 'teléfono', width: 375, height: 667 },
  { name: 'escritorio', width: 1280, height: 800 },
]

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal en ${where}`).toBeLessThanOrEqual(0)
}

/** Todo botón, enlace y desplegable de la zona principal mide al menos 44 px de alto. */
async function expectTouchTargets(page: Page, where: string) {
  const small = await page
    .locator('main button:visible, main a:visible, main summary:visible')
    .evaluateAll((elements) =>
      elements
        .map((el) => ({
          text: (el.textContent ?? '').trim().slice(0, 30),
          h: el.getBoundingClientRect().height,
          inline: getComputedStyle(el).display === 'inline',
        }))
        // los enlaces dentro de un párrafo (en línea) no son controles independientes
        .filter((item) => !item.inline && item.h < 43.5),
    )
  expect(small, `áreas táctiles menores a 44 px en ${where}`).toEqual([])
}

let email = ''

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  email = uniqueEmail('respg')
  await register(page, email)
  seedGoal(email, 5000, localDate(-3))
  seedEntry(email, { name: 'Banquete responsive e2e', energy: 5875 })
  seedEntry(email, { name: 'Sin energia responsive e2e', energy: 0, meal: 'snack' })
})

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: la tarjeta del día y la pantalla del objetivo no desbordan`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    await page.goto(`/comidas/${localDate()}`)
    await expect(card(page).getByText(/más que el objetivo/)).toBeVisible()
    await expect(card(page).getByText('5.875 − 5.000 = 875 kcal')).toBeVisible()
    await card(page).getByText(g.howTitle).click()
    await expect(card(page).getByText(g.how[1]!)).toBeVisible()
    await expectNoHorizontalScroll(page, `la tarjeta (${viewport.name})`)
    await expectTouchTargets(page, `la tarjeta (${viewport.name})`)

    seedGoal(email, 1100, localDate())
    await page.goto('/objetivo')
    await expect(page.getByText(g.lowGoalNote)).toBeVisible()
    await expectNoHorizontalScroll(page, `/objetivo (${viewport.name})`)
    await expectTouchTargets(page, `/objetivo (${viewport.name})`)

    await page.getByLabel(g.page.fieldLabel, { exact: false }).fill('999')
    await page.getByRole('button', { name: g.page.save }).click()
    await expect(page.getByText(g.validation.range)).toBeVisible()
    await expectNoHorizontalScroll(page, `/objetivo con error (${viewport.name})`)

    await page.getByRole('button', { name: g.page.remove }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoHorizontalScroll(page, `el diálogo (${viewport.name})`)
  })
}
