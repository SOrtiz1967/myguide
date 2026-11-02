// Spec 012: evolución de un ejercicio, comparación y resumen de actividad de punta a punta (con accesibilidad a 375 y 1280 px).
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const p = es.trainingProgress
const a = es.trainingActivity

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`

/** Crea un ejercicio y sesiones realizadas: [días atrás, peso]. Cada sesión lleva una serie de 8 repeticiones. */
function seedExercise(email: string, sessions: [number, number][]): string {
  const user = userOf(email)
  const exercise = dbQuery(
    `select tests.create_exercise(${user}, 'Press e2e progreso', 'reps_weight')`,
  )
  for (const [daysAgo, weight] of sessions) {
    const session = dbQuery(
      `select tests.create_session(${user}, current_date - ${daysAgo}, 'completed')`,
    )
    const item = dbQuery(`select tests.add_session_exercise('${session}', '${exercise}')`)
    dbQuery(`select tests.add_session_set('${item}', 8, ${weight})`)
  }
  return exercise
}

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

test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('de la historia del ejercicio a su evolución: medidas, períodos y comparación', async ({
  page,
}) => {
  const email = uniqueEmail('prog')
  await register(page, email)
  // Últimos 28 días: 60, 65, 70 kg. Los 28 anteriores: 50 y 55 kg.
  const exercise = seedExercise(email, [
    [50, 50],
    [40, 55],
    [20, 60],
    [10, 65],
    [3, 70],
  ])

  await page.goto(`/ejercicios/${exercise}/historia`)
  await page.getByRole('link', { name: p.seeProgress }).click()
  await expect(page).toHaveURL(new RegExp(`/ejercicios/${exercise}/evolucion`))
  await expect(page.getByRole('group', { name: p.measureLabel })).toBeVisible()

  // Por omisión: peso máximo de las últimas 12 semanas; una fila por sesión en la tabla.
  await page.getByText(p.table.summary).click()
  const table = page.getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(6)
  await expect(table.getByText('70 kg')).toBeVisible()
  await expect(page.getByText(p.legendLine)).toBeVisible()

  // Otra medida: volumen = 8 repeticiones por el peso.
  await page.getByRole('button', { name: p.measures.volume }).click()
  await expect(table.getByText('560 kg')).toBeVisible()

  // Cuatro semanas: tres sesiones, y la comparación con las cuatro anteriores.
  await page.getByRole('button', { name: p.measures.max_weight }).click()
  await page.getByRole('button', { name: p.periods['4w'] }).click()
  await expect(table.getByRole('row')).toHaveCount(4)
  await page.getByRole('button', { name: p.compare.title }).click()
  const panel = page.getByRole('region', { name: p.compare.title })
  await expect(panel.getByText(p.compare.sessions(3))).toBeVisible()
  await expect(panel.getByText(p.compare.sessions(2))).toBeVisible()
  await expect(panel.getByText('65 kg')).toBeVisible()
  await expect(panel.getByText('52,5 kg')).toBeVisible()
  await expect(panel.getByText(`${p.compare.difference}: +12,5 kg`)).toBeVisible()
  await expect(page.getByText(/récord|racha|mejoraste|retrocediste/i)).toHaveCount(0)
})

test('con menos de 3 sesiones no hay línea y se avisa; sin sesiones hay un estado vacío', async ({
  page,
}) => {
  const email = uniqueEmail('prog')
  await register(page, email)
  const exercise = seedExercise(email, [
    [20, 60],
    [5, 65],
  ])
  await page.goto(`/ejercicios/${exercise}/evolucion`)
  await expect(page.getByText(p.notEnough)).toBeVisible()
  await expect(page.getByText(p.legendLine)).toHaveCount(0)

  const empty = dbQuery(
    `select tests.create_exercise(${userOf(email)}, 'Sin sesiones e2e', 'reps_weight')`,
  )
  await page.goto(`/ejercicios/${empty}/evolucion`)
  await expect(page.getByText(p.empty)).toBeVisible()
})

test('el resumen de actividad cuenta las sesiones realizadas por semana', async ({ page }) => {
  const email = uniqueEmail('prog')
  await register(page, email)
  seedExercise(email, [
    [2, 60],
    [1, 62],
    [30, 55],
  ])
  await page.goto('/entrenamiento')
  await page.getByRole('link', { name: p.seeSummary }).click()
  await expect(page).toHaveURL(/\/entrenamiento\/resumen/)
  await expect(page.getByText(a.total(3))).toBeVisible()
  const list = page.getByRole('list', { name: a.chartLabel })
  await expect(list.getByText(a.none).first()).toBeVisible()
  await page.getByRole('button', { name: a.groupings.month }).click()
  await expect(list.getByRole('listitem').first()).toBeVisible()
  await expect(page.getByText(/racha|objetivo|constancia/i)).toHaveCount(0)
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}: evolución, comparación y resumen`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const email = uniqueEmail('proga')
    await register(page, email)
    const exercise = seedExercise(email, [
      [50, 50],
      [40, 55],
      [20, 60],
      [10, 65],
      [3, 70],
    ])

    await page.goto(`/ejercicios/${exercise}/evolucion`)
    await expect(page.getByRole('group', { name: p.measureLabel })).toBeVisible()
    await expectNoViolations(page, `evolución (${label})`)
    await expectNoHorizontalScroll(page, `evolución (${label})`)

    await page.getByRole('button', { name: p.periods['4w'] }).click()
    await page.getByRole('button', { name: p.compare.title }).click()
    await expect(page.getByRole('region', { name: p.compare.title })).toBeVisible()
    await page.getByText(p.table.summary).click()
    await expectNoViolations(page, `comparación y tabla (${label})`)
    await expectNoHorizontalScroll(page, `comparación y tabla (${label})`)

    await page.goto('/entrenamiento/resumen')
    await expect(page.getByText(a.total(5))).toBeVisible()
    await expectNoViolations(page, `resumen (${label})`)
    await expectNoHorizontalScroll(page, `resumen (${label})`)
  })
}
