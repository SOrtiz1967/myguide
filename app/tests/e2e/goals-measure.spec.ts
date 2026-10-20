// T049 (spec 004): mediciones de SC-001 y SC-002. No es una prueba de regresión estricta: los topes son
// los de la spec, y los valores medidos se imprimen para registrarlos en research.md.
import { devices, expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import { localDate, savedGoals, seedGoal } from './goals-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

// Se mide sobre la compilación de producción (preview), que es lo que llega a las personas.
test.use({ ...devices['Pixel 7'], baseURL: 'http://localhost:4173' })

const g = es.goal

let email = ''
const user = () => `(select id from auth.users where email = '${email}')`

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  email = uniqueEmail('meas')
  await register(page, email)
})

test('SC-001: fijar un objetivo por primera vez desde el día en 3 interacciones y menos de 20 s', async ({
  page,
}) => {
  await page.goto(`/comidas/${localDate()}`)
  const card = page.getByRole('region', { name: g.cardTitle })
  await expect(card.getByRole('link', { name: g.invite })).toBeVisible()

  let interactions = 0
  const started = Date.now()
  await card.getByRole('link', { name: g.invite }).click()
  interactions++ // 1. abrir el objetivo
  await page.getByLabel(g.page.fieldLabel, { exact: false }).fill('2000')
  interactions++ // 2. escribir el valor
  await page.getByRole('button', { name: g.page.save }).click()
  interactions++ // 3. guardar
  await expect(page.getByRole('status').filter({ hasText: g.page.saved })).toBeVisible()
  await expect(card.getByText(g.goalLine(2000))).toBeVisible()
  const ms = Date.now() - started

  console.log(`MEDICION SC-001 objetivo: ${interactions} interacciones en ${ms} ms`)
  expect(savedGoals(email)).toEqual(['2000'])
  expect(interactions).toBeLessThanOrEqual(3)
  expect(ms).toBeLessThan(20_000)
})

const ITEMS = 60
const DAYS = 31

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!
}

test('SC-002: un día con 60 ítems y objetivo se ve completo, con el resumen, en menos de 2 s', async ({
  page,
  context,
}) => {
  test.setTimeout(300_000)
  seedGoal(email, 6000, localDate(-40), new Date(Date.now() - 40 * 86400000).toISOString())
  // 31 días distintos con 60 ítems cada uno, para que ninguna medición se apoye en datos ya guardados.
  dbQuery(
    `select tests.create_manual_entry(${user()}, date '${localDate()}' - d, (array['breakfast','lunch','snack','dinner','extra'])[1 + (g % 5)], 'Item ' || g || ' goalmed e2e', 100 + g) from generate_series(0, ${DAYS - 1}) d, generate_series(1, ${ITEMS}) g`,
  )
  expect(dbQuery(`select count(*) from public.meal_entries where user_id = ${user()}`)).toBe(
    String(DAYS * ITEMS),
  )

  // 4G típico: ~9 Mbps de bajada, 1,5 Mbps de subida y 170 ms de latencia por pedido.
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 170,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (1.5 * 1024 * 1024) / 8,
  })
  const dayShown = async () => {
    await expect(page.getByText(`Item ${ITEMS} goalmed e2e`)).toBeVisible()
    await expect(page.getByRole('region', { name: es.meals.day.total })).toContainText('kcal')
    // el resumen del objetivo forma parte de la vista completa
    await expect(page.getByRole('region', { name: g.cardTitle })).toContainText('% del objetivo')
  }

  // 1. Dentro de la aplicación: del día de hoy al anterior (el caso habitual).
  await page.goto(`/comidas/${localDate()}`)
  await dayShown()
  const warm: number[] = []
  for (let i = 0; i < DAYS - 1; i++) {
    const started = Date.now()
    await page.getByRole('link', { name: /^Día anterior/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/^$/)
    await dayShown()
    warm.push(Date.now() - started)
  }
  const warmP95 = percentile95(warm)
  console.log(
    `MEDICION SC-002 con objetivo, dentro de la app (ms): ${warm.join(', ')}; p95 ${warmP95} ms`,
  )

  // 2. Carga en frío de la página del día (recarga completa: módulos, sesión, perfil, historial y datos).
  const cold: number[] = []
  for (let i = 0; i < 20; i++) {
    await page.goto('/perfil')
    const started = Date.now()
    await page.goto(`/comidas/${localDate()}`)
    await dayShown()
    cold.push(Date.now() - started)
  }
  const sorted = [...cold].sort((a, b) => a - b)
  console.log(
    `MEDICION SC-002 con objetivo, carga en frío (ms): ${cold.join(', ')}; mediana ${sorted[Math.floor(sorted.length / 2)]} ms; p95 ${percentile95(cold)} ms`,
  )

  expect(warmP95).toBeLessThan(2000)
})
