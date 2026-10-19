// T069 (spec 003): mediciones de SC-001 y SC-002. No es una prueba de regresión estricta: los
// topes son los de la spec, y los valores medidos se imprimen para registrarlos en research.md.
import { devices, expect, test } from '@playwright/test'
import { es } from '../../src/copy/es'
import {
  clearSeededEntries,
  clearSeededFoods,
  dbQuery,
  register,
  resetRateLimits,
  seedCatalogFoods,
  stubTurnstile,
  uniqueEmail,
} from './support'

// Se mide sobre la compilación de producción (preview), que es lo que llega a las personas: el
// servidor de desarrollo sirve cientos de módulos sueltos y no representa la carga real.
test.use({ ...devices['Pixel 7'], baseURL: 'http://localhost:4173' })

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

let email = ''
const user = () => `(select id from auth.users where email = '${email}')`

test.beforeAll(() => {
  clearSeededEntries()
  clearSeededFoods()
  seedCatalogFoods([{ id: 'ms1', name: 'Arroz medicion e2e', energy: 130 }])
})

test.afterAll(() => {
  clearSeededEntries()
  clearSeededFoods()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  email = uniqueEmail()
  await register(page, email)
})

test('SC-001: agregar un alimento nuevo (4 interacciones) y un reciente (2)', async ({ page }) => {
  await page.goto(`/comidas/${today()}`)
  await expect(page.getByRole('region', { name: es.meals.names.lunch })).toBeVisible()

  let interactions = 0
  const started = Date.now()
  await page.getByRole('link', { name: es.meals.day.addTo(es.meals.names.lunch) }).click()
  interactions++ // 1. elegir la comida
  await page.getByRole('searchbox', { name: es.meals.add.search }).fill('arroz medicion')
  interactions++ // 2. buscar
  await page.getByRole('button', { name: /Arroz medicion e2e/ }).click()
  interactions++ // 3. elegir el alimento
  await page.getByLabel(es.meals.quantity.amountGrams).fill('150')
  await page.getByRole('button', { name: es.meals.add.confirm }).click()
  interactions++ // 4. confirmar la cantidad
  await expect(page.getByText(es.meals.addedTo.lunch)).toBeVisible()
  const searchMs = Date.now() - started

  await page.goto(`/comidas/${today()}/agregar?comida=dinner`)
  const recent = page.getByRole('button', { name: /Arroz medicion e2e/ })
  await expect(recent).toBeVisible()
  let recentInteractions = 0
  const startedRecent = Date.now()
  await recent.click()
  recentInteractions++
  await page.getByRole('button', { name: es.meals.add.confirm }).click()
  recentInteractions++
  await expect(page.getByText(es.meals.addedTo.dinner)).toBeVisible()
  const recentMs = Date.now() - startedRecent

  console.log(
    `MEDICION SC-001: nuevo ${interactions} interacciones en ${searchMs} ms; reciente ${recentInteractions} interacciones en ${recentMs} ms`,
  )
  expect(interactions).toBeLessThanOrEqual(4)
  expect(recentInteractions).toBeLessThanOrEqual(2)
  expect(searchMs).toBeLessThan(30_000)
})

const ITEMS = 60
const DAYS = 31

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!
}

test('SC-002: un día con 60 ítems se ve completo, con totales, en menos de 2 s (red móvil emulada)', async ({
  page,
  context,
}) => {
  test.setTimeout(300_000)
  // 31 días distintos con 60 ítems cada uno, para que ninguna medición se apoye en datos ya guardados.
  dbQuery(
    `select tests.create_manual_entry(${user()}, date '${today()}' - d, (array['breakfast','lunch','snack','dinner','extra'])[1 + (g % 5)], 'Item ' || g || ' medicion e2e', 100 + g) from generate_series(0, ${DAYS - 1}) d, generate_series(1, ${ITEMS}) g`,
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
    await expect(page.getByText(`Item ${ITEMS} medicion e2e`)).toBeVisible()
    await expect(page.getByRole('region', { name: es.meals.day.total })).toContainText('kcal')
  }

  // 1. Dentro de la aplicación: del día de hoy al anterior (el caso habitual).
  await page.goto(`/comidas/${today()}`)
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
  console.log(`MEDICION SC-002 dentro de la app (ms): ${warm.join(', ')}; p95 ${warmP95} ms`)

  // 2. Carga en frío de la página del día (recarga completa: módulos, sesión, perfil y datos).
  const cold: number[] = []
  for (let i = 0; i < 20; i++) {
    await page.goto('/perfil')
    const started = Date.now()
    await page.goto(`/comidas/${today()}`)
    await dayShown()
    cold.push(Date.now() - started)
  }
  const sorted = [...cold].sort((a, b) => a - b)
  console.log(
    `MEDICION SC-002 carga en frío (ms): ${cold.join(', ')}; mediana ${sorted[Math.floor(sorted.length / 2)]} ms; p95 ${percentile95(cold)} ms`,
  )

  expect(warmP95).toBeLessThan(2000)
})
