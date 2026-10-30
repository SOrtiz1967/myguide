// Spec 022: suplementación de punta a punta (lista, marcas del día, archivado, aislamiento y accesibilidad a 375 y 1280 px).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const c = es.supplements

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const marks = (email: string) =>
  dbQuery(`select count(*) from public.supplement_marks where user_id = ${userOf(email)}`)
const supplements = (email: string) =>
  dbQuery(`select count(*) from public.supplements where user_id = ${userOf(email)}`)

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

async function expectNoHorizontalScroll(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `Desplazamiento horizontal en ${name}`).toBeLessThanOrEqual(0)
}

async function add(page: Page, name: string, dose = '') {
  await page.getByLabel(c.form.name).fill(name)
  await page.getByLabel(c.form.dose).fill(dose)
  await page.getByRole('button', { name: c.form.add }).click()
  await expect(page.getByText(c.added)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(150_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('armar la lista, marcar en el inicio, archivar y eliminar', async ({ page }) => {
  const email = uniqueEmail('sup')
  await register(page, email)

  // El inicio sin suplementos invita sin insistir.
  await page.goto('/')
  const block = page.getByRole('region', { name: c.day.title })
  await expect(block.getByText(new RegExp(c.day.empty))).toBeVisible()

  await page.goto('/suplementos')
  await expect(page.getByText(c.emptyTitle)).toBeVisible()
  await add(page, 'Creatina', '5 g')
  await add(page, 'Vitamina D')
  expect(supplements(email)).toBe('2')

  // Un nombre repetido (sin distinguir mayúsculas) se rechaza con un mensaje claro y no guarda nada.
  await page.getByLabel(c.form.name).fill('creatina')
  await page.getByRole('button', { name: c.form.add }).click()
  await expect(page.getByText(c.errors.name_taken)).toBeVisible()
  expect(supplements(email)).toBe('2')

  // Corregir la dosis.
  await page.getByRole('button', { name: `${c.edit} Creatina` }).click()
  // En modo corrección el formulario de la fila es el último de la pantalla.
  await page.getByLabel(c.form.dose).last().fill('3 g')
  await page.getByRole('button', { name: c.form.saveChanges }).click()
  await expect(page.getByText(c.updated)).toBeVisible()
  await expect(page.getByText(/3 g/)).toBeVisible()

  // Marcar en el inicio: «Sin registro» pasa a «Tomado» y se conserva al recargar.
  await page.goto('/')
  const day = page.getByRole('region', { name: c.day.title })
  await expect(day.getByText(c.day.none)).toHaveCount(2)
  await day.getByRole('checkbox', { name: /Creatina/ }).click()
  await expect(day.getByText(c.day.taken)).toHaveCount(1)
  expect(marks(email)).toBe('1')
  await page.reload()
  await expect(
    page.getByRole('region', { name: c.day.title }).getByRole('checkbox', { name: /Creatina/ }),
  ).toBeChecked()

  // Archivar conserva la marca de hoy: hoy sigue viéndose, y sale de los días sin marca.
  await page.goto('/suplementos')
  await page.getByRole('button', { name: `${c.archive} Vitamina D` }).click()
  await expect(page.getByText(c.archivedDone)).toBeVisible()
  await page.goto('/')
  await expect(
    page.getByRole('region', { name: c.day.title }).getByRole('checkbox', { name: /Vitamina D/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: c.day.title }).getByRole('checkbox', { name: /Creatina/ }),
  ).toBeChecked()

  // Eliminar pide confirmación y se lleva sus marcas.
  await page.goto('/suplementos')
  await page.getByRole('button', { name: `${c.delete} Creatina` }).click()
  await page.getByRole('dialog').getByRole('button', { name: c.form.cancel }).click()
  expect(supplements(email)).toBe('2')
  await page.getByRole('button', { name: `${c.delete} Creatina` }).click()
  await page.getByRole('dialog').getByRole('button', { name: c.confirmDelete }).click()
  await expect(page.getByText(c.deletedDone)).toBeVisible()
  expect(supplements(email)).toBe('1')
  expect(marks(email)).toBe('0')

  // Nada de culpa ni de recomendaciones en pantalla.
  await expect(page.getByText(/olvidaste|racha|te recomendamos|deberías/i)).toHaveCount(0)
})

test('un día de la semana se puede marcar y uno futuro no', async ({ page }) => {
  const email = uniqueEmail('sup')
  await register(page, email)
  await page.goto('/suplementos')
  await add(page, 'Creatina')

  await page.goto('/')
  const days = page.getByRole('button', { name: /Calorías:/ })
  await expect(days).toHaveCount(7)
  const box = () =>
    page.getByRole('region', { name: c.day.title }).getByRole('checkbox', { name: /Creatina/ })

  // El lunes de esta semana nunca es futuro: se puede marcar y queda guardado en ese día.
  await days.first().click()
  await box().click()
  await expect(box()).toBeChecked()
  await expect(page.getByText(c.day.taken)).toBeVisible()
  expect(marks(email)).toBe('1')

  // El domingo es futuro salvo que hoy lo sea: no deja marcar y lo explica.
  if (new Date().getDay() !== 0) {
    await days.last().click()
    await expect(box()).toBeDisabled()
    await expect(page.getByText(c.day.future)).toBeVisible()
  }
})

test('otra cuenta no ve ni toca los suplementos', async ({ page, browser }) => {
  const emailA = uniqueEmail('dueno')
  await register(page, emailA)
  await page.goto('/suplementos')
  await add(page, 'Creatina')
  const id = dbQuery(`select id from public.supplements where user_id = ${userOf(emailA)}`)

  const other = await browser.newPage()
  await stubTurnstile(other)
  const emailB = uniqueEmail('otra')
  await register(other, emailB)
  await other.goto('/suplementos')
  await expect(other.getByText(c.emptyTitle)).toBeVisible()
  await other.goto('/')
  await expect(other.getByRole('region', { name: c.day.title }).getByRole('checkbox')).toHaveCount(
    0,
  )

  // Los datos de A siguen intactos y B no puede marcar ni cambiar nada de A.
  expect(supplements(emailA)).toBe('1')
  expect(dbQuery(`select name from public.supplements where id = '${id}'`)).toBe('Creatina')
  expect(marks(emailA)).toBe('0')
  await other.close()
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}: vacío, lista, archivados e inicio`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await register(page, uniqueEmail('sua'))
    await page.goto('/suplementos')
    await expect(page.getByText(c.emptyTitle)).toBeVisible()
    await expectNoViolations(page, `vacío (${label})`)
    await expectNoHorizontalScroll(page, `vacío (${label})`)

    await add(page, 'Creatina', '5 g')
    await add(
      page,
      'Nombre largo de suplemento para probar el ajuste de línea',
      'una dosis larga escrita por la persona',
    )
    await page.getByRole('button', { name: `${c.archive} Creatina` }).click()
    await expect(page.getByText(c.archivedDone)).toBeVisible()
    await page.getByText(c.archivedTitle(1)).click()
    await expectNoViolations(page, `lista con archivados (${label})`)
    await expectNoHorizontalScroll(page, `lista con archivados (${label})`)

    await page.goto('/')
    await expect(page.getByRole('region', { name: c.day.title }).getByRole('checkbox')).toHaveCount(
      1,
    )
    await expectNoViolations(page, `inicio (${label})`)
    await expectNoHorizontalScroll(page, `inicio (${label})`)
  })
}
