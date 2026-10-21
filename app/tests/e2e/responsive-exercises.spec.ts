// T063 (spec 005, escenario 31, SC-011, FR-036): las pantallas de ejercicios funcionan en teléfono y en
// escritorio, sin desplazamiento horizontal y con áreas táctiles de 44 px o más (incluidas las casillas).
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedCatalogExercises } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.exercises
const f = t.form

const VIEWPORTS = [
  { name: 'teléfono', width: 375, height: 667 },
  { name: 'escritorio', width: 1280, height: 800 },
]

const LONG_NAME =
  'Remo inclinado con barra olímpica agarre supino y pausa isométrica en la parte alta del movimiento edición larga e2e'
const LONG_WORD = 'Supercalifragilisticoespialidosoextraordinariamenteprolongadoe2e'
const LONG_DESCRIPTION = Array.from(
  { length: 12 },
  (_, i) =>
    `${i + 1}. Paso número ${i + 1} con una explicación larga que sigue y sigue para comprobar que el texto baja de renglón sin romper el diseño ${LONG_WORD}.`,
).join('\n')

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal en ${where}`).toBeLessThanOrEqual(0)
}

/** Todo botón, pestaña, enlace con aspecto de botón, casilla de músculo y opción de radio mide 44 px o más. */
async function expectTouchTargets(page: Page, where: string) {
  const small = await page
    .locator(
      'button:visible, [role="tab"]:visible, a.btn-primary:visible, a.btn-secondary:visible, select:visible, input:not([type="checkbox"]):not([type="radio"]):visible, label:has(input[type="checkbox"]):visible, label:has(input[type="radio"]):visible',
    )
    .evaluateAll((elements) =>
      elements
        .map((el) => ({
          text: (el.textContent ?? '').trim().slice(0, 30),
          h: el.getBoundingClientRect().height,
        }))
        .filter((item) => item.h < 43.5),
    )
  expect(small, `áreas táctiles menores a 44 px en ${where}`).toEqual([])
}

test.beforeAll(() => {
  clearSeededExercises()
  seedCatalogExercises([
    {
      id: 'resp1',
      name: LONG_NAME,
      originalName: 'Supinated Grip Pause Barbell Bent Over Row With Extended Isometric Hold',
      aliases: [LONG_WORD],
      measurement: 'reps_weight',
      primary: ['lats', 'middle back', 'lower back', 'traps', 'biceps'],
      secondary: ['forearms', 'shoulders', 'hamstrings', 'glutes'],
      equipment: 'barbell',
      description: LONG_DESCRIPTION,
    },
  ])
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail('exresp'))
})

for (const viewport of VIEWPORTS) {
  test.describe(`en ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('búsqueda, detalle, formulario y fuentes caben sin desplazamiento horizontal', async ({
      page,
    }) => {
      await page.goto('/ejercicios?q=remo+inclinado+con+barra+olimpica+e2e')
      await expect(page.getByRole('tabpanel').getByRole('link').first()).toBeVisible()
      await expectNoHorizontalScroll(page, 'búsqueda con un nombre largo')
      await expectTouchTargets(page, 'búsqueda')

      await page.goto('/ejercicios?q=nada+que+encontrar+xyz&musculo=neck')
      await expect(page.getByText(t.emptyFiltersTitle)).toBeVisible()
      await expectNoHorizontalScroll(page, 'búsqueda sin resultados con filtros')
      await expectTouchTargets(page, 'búsqueda sin resultados')

      const id = dbQuery("select id from public.exercises where source_item_id = 'E2E-resp1'")
      await page.goto(`/ejercicios/${id}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Remo inclinado')
      await expectNoHorizontalScroll(page, 'detalle con nombre y descripción largos')
      await expectTouchTargets(page, 'detalle')

      await page.goto('/ejercicios/nuevo')
      await expectNoHorizontalScroll(page, 'formulario')
      await expectTouchTargets(page, 'formulario')

      await page.goto('/fuentes')
      await expect(
        page.getByRole('heading', { level: 2, name: t.sources.exercisesTitle }),
      ).toBeVisible()
      await expectNoHorizontalScroll(page, 'fuentes')
      await expectTouchTargets(page, 'fuentes')
    })

    test('un nombre sin espacios, muy largo, no rompe la lista ni el detalle', async ({ page }) => {
      await page.goto('/ejercicios/nuevo')
      await page.getByLabel(f.name, { exact: true }).fill(LONG_WORD)
      await page.getByRole('radio', { name: /^Tiempo/ }).check()
      await page.getByRole('button', { name: t.actions.save }).click()
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Supercalifragilistico')
      await expectNoHorizontalScroll(page, 'detalle con un nombre sin espacios')

      await page.goto(`/ejercicios?q=${LONG_WORD}`)
      await expect(page.getByRole('tabpanel').getByRole('link').first()).toBeVisible()
      await expectNoHorizontalScroll(page, 'lista con un nombre sin espacios')
    })

    test('se puede crear un ejercicio completo en esa pantalla', async ({ page }) => {
      await page.goto('/ejercicios/nuevo')
      await page.getByLabel(f.name, { exact: true }).fill('Creado en pantalla chica e2e')
      await page.getByRole('radio', { name: /^Repeticiones y peso/ }).check()
      await page.getByRole('group', { name: f.primaryLegend }).getByLabel('Pecho').check()
      await page.getByRole('button', { name: t.actions.save }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Creado en pantalla chica e2e' }),
      ).toBeVisible()
      await expectNoHorizontalScroll(page, 'detalle recién creado')
    })
  })
}
