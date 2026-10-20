// T048 (spec 004, escenario 31 del quickstart, FR-029, SC-007): al cerrar sesión y entrar con otra cuenta
// en la MISMA pestaña, la segunda no ve nada de la primera, ni siquiera mientras carga.
//
// Para que la prueba sea válida no se recarga la página: la caché de consultas vive en memoria y una
// recarga la vaciaría sola. Un observador del DOM, instalado desde el cierre de sesión, anota cualquier
// nodo con datos de A que aparezca después.
import { expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import { localDate, seedEntry, seedGoal } from './goals-support'
import { PASSWORD, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const g = es.goal
const MARKER = 'Secreto de A session e2e'

test.beforeEach(() => {
  resetRateLimits()
})

test('escenario 31: la cuenta B no ve datos de A en la misma pestaña, ni un instante', async ({
  page,
  browser,
}) => {
  await stubTurnstile(page)
  const emailA = uniqueEmail('swa')
  await register(page, emailA)
  seedGoal(emailA, 2000, localDate(-2))
  seedEntry(emailA, { name: MARKER, energy: 777 })

  // La cuenta B se crea aparte (otro contexto) para tener sus credenciales.
  const other = await browser.newPage()
  await stubTurnstile(other)
  const emailB = uniqueEmail('swb')
  await register(other, emailB)
  await other.close()

  // A ve su objetivo y su ítem.
  await page.getByRole('link', { name: es.meals.navLink }).click()
  await expect(page.getByText(MARKER)).toBeVisible()
  await expect(page.getByRole('region', { name: g.cardTitle })).toContainText(g.goalLine(2000))

  // A partir de aquí, cualquier nodo con datos de A que se agregue al DOM es una fuga.
  await page.evaluate(
    ({ marker, goalText }) => {
      const leaks: string[] = []
      ;(window as unknown as { __leaks: string[] }).__leaks = leaks
      const check = (node: Node) => {
        const text = node.textContent ?? ''
        if (text.includes(marker) || text.includes(goalText) || text.includes('777 kcal')) {
          leaks.push(text.slice(0, 80))
        }
      }
      new MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach(check)
          if (record.type === 'characterData') check(record.target)
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true })
    },
    { marker: MARKER, goalText: 'Objetivo: 2.000' },
  )

  // Cerrar sesión y entrar como B sin recargar.
  await page.getByRole('button', { name: es.auth.actions.logout }).click()
  await expect(page).toHaveURL(/\/ingresar/)
  await page.getByLabel(es.auth.labels.email).fill(emailB)
  await page.getByLabel(es.auth.labels.password).fill(PASSWORD)
  await page.getByRole('button', { name: es.auth.actions.login }).click()
  // La aplicación devuelve a B a la pantalla donde estaba A (un día), sin recargar: justo ahí la caché
  // de A, si siguiera, aparecería de inmediato.
  await expect(page).toHaveURL(new RegExp(`/comidas/${localDate()}$`))
  await expect(page.getByRole('region', { name: g.cardTitle })).toBeVisible()
  await expect(page.getByText(es.meals.day.empty)).toBeVisible()

  await expect(page.getByText(MARKER)).toHaveCount(0)
  await expect(page.getByRole('region', { name: g.cardTitle })).not.toContainText(g.goalLine(2000))
  await expect(page.getByRole('region', { name: g.cardTitle })).toContainText(g.invite)

  const leaks = await page.evaluate(() => (window as unknown as { __leaks: string[] }).__leaks)
  expect(leaks, 'datos de A que llegaron a aparecer en el DOM de B').toEqual([])
})
